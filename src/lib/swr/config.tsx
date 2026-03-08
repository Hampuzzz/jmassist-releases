"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return res.json();
  });

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,   // Electron desktop — no tab switching
        dedupingInterval: 5000,      // Dedupe identical requests within 5s
        errorRetryCount: 2,          // Retry failed requests twice
        revalidateIfStale: true,     // Background refresh stale data
        keepPreviousData: true,      // Show old data while revalidating
      }}
    >
      {children}
    </SWRConfig>
  );
}
