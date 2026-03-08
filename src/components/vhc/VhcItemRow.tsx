"use client";

import React, { memo, useCallback } from "react";
import { Camera, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VhcItemState {
  id: string;
  category: string;
  label: string;
  severity: "green" | "yellow" | "red";
  comment: string;
  estimatedCost: string;
  mediaUrls: string[];
}

interface Props {
  item: VhcItemState;
  onChange: (id: string, field: keyof VhcItemState, value: unknown) => void;
  onCameraClick?: (id: string) => void;
}

const SEVERITY_CONFIG = {
  green:  { bg: "bg-green-600",  activeBg: "bg-green-500", ring: "ring-green-400",  label: "OK" },
  yellow: { bg: "bg-yellow-500", activeBg: "bg-yellow-400", ring: "ring-yellow-300", label: "Obs" },
  red:    { bg: "bg-red-600",    activeBg: "bg-red-500",   ring: "ring-red-400",    label: "Akut" },
} as const;

function VhcItemRowInner({ item, onChange, onCameraClick }: Props) {
  const isExpanded = item.severity !== "green";

  const handleSeverity = useCallback(
    (sev: "green" | "yellow" | "red") => onChange(item.id, "severity", sev),
    [item.id, onChange],
  );

  return (
    <div className="border-b border-workshop-border/50 py-3 px-2">
      {/* Row: label + severity buttons */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium text-workshop-text truncate">
          {item.label}
        </span>

        <div className="flex gap-1.5">
          {(["green", "yellow", "red"] as const).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            const isActive = item.severity === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => handleSeverity(sev)}
                className={cn(
                  "w-11 h-11 rounded-lg text-xs font-bold text-white transition-all touch-manipulation",
                  isActive
                    ? `${cfg.activeBg} ring-2 ${cfg.ring} scale-110 shadow-lg`
                    : `${cfg.bg} opacity-40 hover:opacity-70`,
                )}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded: comment + cost + camera (only for yellow/red) */}
      {isExpanded && (
        <div className="mt-2 pl-1 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MessageSquare className="absolute left-2 top-2.5 w-4 h-4 text-workshop-muted" />
              <input
                type="text"
                value={item.comment}
                onChange={(e) => onChange(item.id, "comment", e.target.value)}
                placeholder="Kommentar..."
                className="w-full pl-8 pr-3 py-2 rounded-md bg-workshop-dark border border-workshop-border text-sm text-workshop-text placeholder:text-workshop-muted"
              />
            </div>
            <input
              type="number"
              value={item.estimatedCost}
              onChange={(e) => onChange(item.id, "estimatedCost", e.target.value)}
              placeholder="Kr"
              className="w-24 px-3 py-2 rounded-md bg-workshop-dark border border-workshop-border text-sm text-workshop-text text-right placeholder:text-workshop-muted"
            />
            {onCameraClick && (
              <button
                type="button"
                onClick={() => onCameraClick(item.id)}
                className="p-2 rounded-md bg-workshop-dark border border-workshop-border text-workshop-muted hover:text-workshop-text transition-colors touch-manipulation"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}
          </div>
          {item.mediaUrls.length > 0 && (
            <div className="flex gap-1 overflow-x-auto">
              {item.mediaUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Foto ${i + 1}`}
                  className="w-16 h-16 object-cover rounded-md border border-workshop-border"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const VhcItemRow = memo(VhcItemRowInner);
