"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Video, X, Upload, RotateCcw, Loader2 } from "lucide-react";

interface Props {
  /** workOrderId or vhcItemId to associate with upload */
  workOrderId?: string;
  vhcItemId?: string;
  /** Called after successful upload */
  onUploaded?: (result: { id: string; url: string; fileName: string; fileType: string }) => void;
  /** Compact mode — just an icon button */
  compact?: boolean;
}

export function MediaCapture({ workOrderId, vhcItemId, onUploaded, compact }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Validate type
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      setError("Endast bilder och video stöds.");
      return;
    }

    // Validate size (50MB max for video, 10MB for images)
    const maxSize = f.type.startsWith("video/") ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (f.size > maxSize) {
      setError(f.type.startsWith("video/") ? "Max 50 MB för video." : "Max 10 MB för bilder.");
      return;
    }

    setError(null);
    setFile(f);

    // Generate preview
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      // Video preview — use object URL
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (workOrderId) formData.append("workOrderId", workOrderId);
      if (vhcItemId) formData.append("vhcItemId", vhcItemId);

      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Upload-fel (HTTP ${res.status})`);
      }

      const result = await res.json();
      onUploaded?.(result);

      // Clear state
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError(err.message ?? "Uppladdning misslyckades.");
    } finally {
      setUploading(false);
    }
  }, [file, workOrderId, vhcItemId, onUploaded]);

  const handleCancel = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // Compact mode — just an icon button that opens file picker
  if (compact && !preview) {
    return (
      <>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1.5 text-xs text-workshop-muted hover:text-workshop-accent hover:bg-workshop-elevated rounded transition-colors"
          title="Ta foto / spela in video"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {/* File input + capture buttons */}
      {!preview && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*";
                fileInputRef.current.capture = "environment";
                fileInputRef.current.click();
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-workshop-elevated hover:bg-workshop-border border border-workshop-border rounded-md text-sm text-workshop-text transition-colors"
          >
            <Camera className="h-4 w-4 text-workshop-accent" />
            Ta foto
          </button>
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "video/*";
                fileInputRef.current.capture = "environment";
                fileInputRef.current.click();
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-workshop-elevated hover:bg-workshop-border border border-workshop-border rounded-md text-sm text-workshop-text transition-colors"
          >
            <Video className="h-4 w-4 text-workshop-accent" />
            Spela in video
          </button>
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*,video/*";
                fileInputRef.current.removeAttribute("capture");
                fileInputRef.current.click();
              }
            }}
            className="flex items-center gap-2 px-3 py-2 bg-workshop-elevated hover:bg-workshop-border border border-workshop-border rounded-md text-sm text-workshop-text transition-colors"
          >
            <Upload className="h-4 w-4 text-workshop-muted" />
            Välj fil
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Preview */}
      {preview && file && (
        <div className="relative rounded-lg overflow-hidden border border-workshop-border bg-black/50">
          {file.type.startsWith("image/") ? (
            <img
              src={preview}
              alt="Förhandsvisning"
              className="w-full max-h-64 object-contain"
            />
          ) : (
            <video
              src={preview}
              controls
              className="w-full max-h-64"
            />
          )}

          {/* File info overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2 flex items-center justify-between">
            <div className="text-xs text-white/80">
              <p className="truncate max-w-[200px]">{file.name}</p>
              <p>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={uploading}
                className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white disabled:opacity-50"
                title="Ta bort"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-workshop-accent hover:bg-workshop-accent/80 text-white text-xs rounded-md disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Laddar upp...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Ladda upp
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 px-3 py-2 rounded-md">
          <X className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
