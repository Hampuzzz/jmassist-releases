"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Film, Image as ImageIcon } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  caption?: string;
}

interface Props {
  /** Pre-loaded media items */
  items?: MediaItem[];
  /** Fetch media from API by workOrderId */
  workOrderId?: string;
  /** Fetch media from API by vhcItemId */
  vhcItemId?: string;
  /** Compact grid layout */
  compact?: boolean;
}

export function MediaGallery({ items: providedItems, workOrderId, vhcItemId, compact }: Props) {
  const [items, setItems] = useState<MediaItem[]>(providedItems ?? []);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch from API if no items provided
  useEffect(() => {
    if (providedItems) {
      setItems(providedItems);
      return;
    }

    if (!workOrderId && !vhcItemId) return;

    const params = new URLSearchParams();
    if (workOrderId) params.set("workOrderId", workOrderId);
    if (vhcItemId) params.set("vhcItemId", vhcItemId);

    setLoading(true);
    fetch(`/api/media?${params}`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [providedItems, workOrderId, vhcItemId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-workshop-muted py-2">
        <div className="h-3 w-3 border-2 border-workshop-accent border-t-transparent rounded-full animate-spin" />
        Laddar media...
      </div>
    );
  }

  if (items.length === 0) return null;

  const isImage = (type: string) => type.startsWith("image/");
  const isVideo = (type: string) => type.startsWith("video/");
  const currentItem = lightboxIndex !== null ? items[lightboxIndex] : null;

  return (
    <>
      {/* Thumbnail grid */}
      <div className={compact ? "flex flex-wrap gap-1.5" : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"}>
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightboxIndex(idx)}
            className={`
              relative rounded-md overflow-hidden border border-workshop-border
              hover:border-workshop-accent transition-colors group
              ${compact ? "w-12 h-12" : "aspect-square"}
            `}
          >
            {isImage(item.fileType) ? (
              <img
                src={item.url}
                alt={item.caption || item.fileName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : isVideo(item.fileType) ? (
              <div className="w-full h-full bg-workshop-elevated flex items-center justify-center">
                <Film className="h-5 w-5 text-workshop-muted group-hover:text-workshop-accent" />
              </div>
            ) : (
              <div className="w-full h-full bg-workshop-elevated flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-workshop-muted" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {currentItem && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Previous */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex - 1 + items.length) % items.length);
              }}
              className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Content */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {isImage(currentItem.fileType) ? (
              <img
                src={currentItem.url}
                alt={currentItem.caption || currentItem.fileName}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            ) : isVideo(currentItem.fileType) ? (
              <video
                src={currentItem.url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-lg"
              />
            ) : null}

            {/* Caption / info */}
            <div className="mt-3 text-center">
              {currentItem.caption && (
                <p className="text-white text-sm mb-1">{currentItem.caption}</p>
              )}
              <p className="text-white/50 text-xs">
                {currentItem.fileName}
                {currentItem.fileSize
                  ? ` — ${(currentItem.fileSize / 1024 / 1024).toFixed(1)} MB`
                  : ""}
              </p>
              <p className="text-white/30 text-xs mt-1">
                {lightboxIndex + 1} / {items.length}
              </p>
            </div>
          </div>

          {/* Next */}
          {items.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex + 1) % items.length);
              }}
              className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-10"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
