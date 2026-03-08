"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useSWRConfig } from "swr";

// ─── Types ───
export interface EnrichEvent {
  id: string;
  type: "progress" | "enriched" | "error" | "captcha" | "waiting" | "done";
  regNr: string;
  brand?: string;
  model?: string;
  year?: number;
  fuel?: string;
  engineCode?: string;
  message?: string;
  timestamp: number;
}

export interface EnrichState {
  running: boolean;
  done: boolean;
  total: number;
  completed: number;
  enriched: number;
  errors: number;
  currentRegNr: string | null;
  currentBrand: string | null;
  currentModel: string | null;
  recentEvents: EnrichEvent[];
  error: string | null;
}

interface EnrichContextValue {
  state: EnrichState;
  startEnrich: (priorityRegNr?: string) => void;
  stopEnrich: () => void;
  dismiss: () => void;
}

const INITIAL_STATE: EnrichState = {
  running: false,
  done: false,
  total: 0,
  completed: 0,
  enriched: 0,
  errors: 0,
  currentRegNr: null,
  currentBrand: null,
  currentModel: null,
  recentEvents: [],
  error: null,
};

const EnrichContext = createContext<EnrichContextValue>({
  state: INITIAL_STATE,
  startEnrich: () => {},
  stopEnrich: () => {},
  dismiss: () => {},
});

export function useEnrichment() {
  return useContext(EnrichContext);
}

const MAX_RECENT_EVENTS = 30;

export function EnrichmentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EnrichState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const { mutate } = useSWRConfig();

  // Revalidate all SWR caches so UI shows fresh data after enrichment
  const revalidateAll = useCallback(() => {
    // Invalidate all SWR keys (vehicles, vagnkort, dashboard, etc.)
    mutate(() => true, undefined, { revalidate: true });
    console.log("[enrich] SWR cache revalidated");
  }, [mutate]);

  // Add event to recent list
  const pushEvent = useCallback(
    (event: Omit<EnrichEvent, "id" | "timestamp">) => {
      setState((prev) => ({
        ...prev,
        recentEvents: [
          { ...event, id: crypto.randomUUID(), timestamp: Date.now() },
          ...prev.recentEvents,
        ].slice(0, MAX_RECENT_EVENTS),
      }));
    },
    [],
  );

  // SSE stream parser
  const parseSSE = useCallback(
    async (res: Response) => {
      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          try {
            const data = JSON.parse(dataLine.slice(6));

            // Update state from SSE event
            setState((prev) => ({
              ...prev,
              completed: data.completed ?? prev.completed,
              total: data.total ?? prev.total,
              enriched: data.enriched ?? prev.enriched,
              errors: data.errors ?? prev.errors,
              currentRegNr: data.regNr ?? prev.currentRegNr,
              currentBrand: data.brand ?? prev.currentBrand,
              currentModel: data.model ?? prev.currentModel,
            }));

            // Push enrichment/error events to log
            if (data.type === "enriched") {
              pushEvent({
                type: "enriched",
                regNr: data.regNr,
                brand: data.brand,
                model: data.model,
                year: data.year,
                fuel: data.fuel,
                engineCode: data.engineCode,
                message: data.message,
              });
            } else if (data.type === "error") {
              pushEvent({
                type: "error",
                regNr: data.regNr,
                message: data.message,
              });
            } else if (data.type === "captcha") {
              pushEvent({
                type: "captcha",
                regNr: data.regNr,
                message: data.message,
              });
            }

            if (data.type === "done") {
              setState((prev) => ({
                ...prev,
                running: false,
                done: true,
                currentRegNr: null,
              }));
              // Revalidate SWR so lists/pages show updated data
              revalidateAll();
            }
          } catch {
            // skip invalid JSON
          }
        }
      }
    },
    [pushEvent, revalidateAll],
  );

  // Start enrichment
  const startEnrich = useCallback(
    async (priorityRegNr?: string) => {
      // Don't start if already running
      if (abortRef.current) return;

      setState((prev) => ({
        ...prev,
        running: true,
        done: false,
        error: null,
        completed: 0,
        enriched: 0,
        errors: 0,
        currentRegNr: null,
        currentBrand: null,
        currentModel: null,
      }));

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const url = priorityRegNr
          ? `/api/vagnkort/enrich?priority=${encodeURIComponent(priorityRegNr)}`
          : "/api/vagnkort/enrich";

        const res = await fetch(url, {
          method: "POST",
          signal: abort.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState((prev) => ({
            ...prev,
            running: false,
            error: body.error ?? `Fel: ${res.status}`,
          }));
          abortRef.current = null;
          return;
        }

        const contentType = res.headers.get("Content-Type") ?? "";
        if (contentType.includes("application/json")) {
          await res.json();
          setState((prev) => ({
            ...prev,
            running: false,
            done: true,
            error: null,
          }));
          abortRef.current = null;
          return;
        }

        await parseSSE(res);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setState((prev) => ({
            ...prev,
            running: false,
            error: err.message ?? "Okänt fel",
          }));
        }
      } finally {
        abortRef.current = null;
        // Always revalidate when enrichment ends (including abort/stop)
        revalidateAll();
      }
    },
    [parseSSE, revalidateAll],
  );

  const stopEnrich = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({ ...prev, running: false, done: prev.enriched > 0 }));
    // Revalidate so saved data shows in UI
    revalidateAll();
  }, [revalidateAll]);

  const dismiss = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return (
    <EnrichContext.Provider value={{ state, startEnrich, stopEnrich, dismiss }}>
      {children}
    </EnrichContext.Provider>
  );
}
