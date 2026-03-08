"use client";

import { useState, useEffect } from "react";
import { Monitor } from "lucide-react";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      getAutoStart: () => Promise<boolean>;
      setAutoStart: (enabled: boolean) => Promise<boolean>;
    };
  }
}

export function AutoStartToggle() {
  const [isElectron, setIsElectron] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (api?.isElectron && api?.getAutoStart) {
      setIsElectron(true);
      api.getAutoStart().then(setAutoStart).catch(() => {});
    }
  }, []);

  if (!isElectron) return null;

  async function toggle() {
    setSaving(true);
    try {
      const newVal = await window.electronAPI!.setAutoStart(!autoStart);
      setAutoStart(newVal);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface p-4 flex items-center gap-4">
      <div className="p-2 bg-workshop-elevated rounded-lg">
        <Monitor className="h-5 w-5 text-workshop-accent" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-workshop-text">Autostart med Windows</p>
        <p className="text-sm text-workshop-muted">
          Starta JM Assist automatiskt när datorn startar
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          autoStart ? "bg-workshop-accent" : "bg-workshop-border"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
            autoStart ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
