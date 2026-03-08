"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Wrench,
  Car,
  Users,
  FileText,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: "work_order" | "vehicle" | "customer" | "invoice";
  action: string;
  title: string;
  subtitle?: string;
  timestamp: string;
}

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  work_order: { icon: Wrench, color: "text-amber-400", bg: "bg-amber-900/30" },
  vehicle: { icon: Car, color: "text-blue-400", bg: "bg-blue-900/30" },
  customer: { icon: Users, color: "text-green-400", bg: "bg-green-900/30" },
  invoice: { icon: FileText, color: "text-purple-400", bg: "bg-purple-900/30" },
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just nu";
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "igår";
  return `${days}d sedan`;
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30_000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  return (
    <div className="surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-workshop-accent" />
          <h2 className="font-semibold text-workshop-text">Systemaktivitet</h2>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchActivity();
          }}
          className="p-1.5 rounded-md text-workshop-muted hover:text-workshop-text hover:bg-workshop-elevated transition-colors"
          title="Uppdatera"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 text-workshop-muted animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-center text-workshop-muted text-sm py-4">
          Ingen aktivitet ännu
        </p>
      )}

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {items.map((item, i) => {
          const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.work_order;
          const Icon = item.action === "enriched" ? Sparkles : config.icon;
          const iconColor =
            item.action === "enriched" ? "text-amber-400" : config.color;
          const iconBg =
            item.action === "enriched" ? "bg-amber-900/30" : config.bg;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-workshop-elevated/50 transition-colors animate-in fade-in slide-in-from-top-1"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: "both" }}
            >
              <div className={`p-1.5 rounded-md ${iconBg} flex-shrink-0 mt-0.5`}>
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-workshop-text leading-tight">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xs text-workshop-muted mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-workshop-muted whitespace-nowrap flex-shrink-0 mt-0.5">
                {timeAgo(item.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
