"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

/**
 * AutoEnrich — silently starts vehicle enrichment ~10s after mount.
 * Runs in the background with low priority (no priority param).
 * Shows a small, non-intrusive indicator at the bottom of the dashboard.
 */
export function AutoEnrich() {
  const [status, setStatus] = useState<"idle" | "checking" | "running" | "done" | "none">("idle");
  const [enriched, setEnriched] = useState(0);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const timer = setTimeout(async () => {
      setStatus("checking");

      // 1. Check if there are vehicles to enrich
      try {
        const queueRes = await fetch("/api/vagnkort/enrich");
        if (!queueRes.ok) { setStatus("none"); return; }
        const queueData = await queueRes.json();
        if (queueData.total === 0) { setStatus("none"); return; }

        setTotal(queueData.total);
        setStatus("running");

        // 2. Start SSE enrichment
        const abort = new AbortController();
        abortRef.current = abort;

        const res = await fetch("/api/vagnkort/enrich", {
          method: "POST",
          signal: abort.signal,
        });

        if (!res.ok) { setStatus("none"); return; }

        const contentType = res.headers.get("Content-Type") ?? "";
        if (contentType.includes("application/json")) {
          // All vehicles already complete or service unavailable
          setStatus("none");
          return;
        }

        // Parse SSE stream with safety limits
        const reader = res.body?.getReader();
        if (!reader) { setStatus("none"); return; }

        const decoder = new TextDecoder();
        let buffer = "";
        let eventCount = 0;
        const MAX_EVENTS = 500; // Safety limit to prevent memory leak
        const TIMEOUT_MS = 5 * 60 * 1000; // 5 minute max duration
        const startTime = Date.now();

        while (true) {
          if (eventCount >= MAX_EVENTS || Date.now() - startTime > TIMEOUT_MS) {
            reader.cancel();
            setStatus("done");
            break;
          }

          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const chunk of lines) {
            eventCount++;
            const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const data = JSON.parse(dataLine.slice(6));
              if (data.completed !== undefined) setCompleted(data.completed);
              if (data.enriched !== undefined) setEnriched(data.enriched);
              if (data.total !== undefined) setTotal(data.total);
              if (data.type === "done") {
                setStatus("done");
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[AutoEnrich] Error:", err.message);
          setStatus("none");
        }
      }
    }, 10_000); // 10s delay before starting

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, []);

  // Don't show anything if nothing to enrich
  if (status === "idle" || status === "checking" || status === "none") {
    return null;
  }

  if (status === "done") {
    if (enriched === 0) return null;
    // Brief success message, auto-dismiss after 15s
    return (
      <AutoDismiss delay={15_000}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800/30 text-green-400 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          {enriched} fordon berikade med teknisk data
        </div>
      </AutoDismiss>
    );
  }

  // Running
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-workshop-elevated/50 border border-workshop-border text-xs text-workshop-muted">
      <Loader2 className="h-3.5 w-3.5 text-workshop-accent animate-spin flex-shrink-0" />
      <span>Berikar fordon i bakgrunden... {completed}/{total} ({pct}%)</span>
      <div className="flex-1 h-1 bg-workshop-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-workshop-accent/60 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AutoDismiss({ delay, children }: { delay: number; children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  if (!visible) return null;
  return <>{children}</>;
}
