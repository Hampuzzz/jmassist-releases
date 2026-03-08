"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  partId: string;
  field: string;
  type?: "number" | "text";
  suffix?: string;
  className?: string;
  align?: "left" | "right";
}

export function EditableCell({ value, partId, field, type = "number", suffix, className = "", align = "right" }: Props) {
  const [editing, setEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function save() {
    if (currentValue === value) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/lager/${partId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: currentValue }),
      });

      if (!res.ok) {
        setCurrentValue(value); // revert
      }
    } catch {
      setCurrentValue(value); // revert
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        step={type === "number" ? "any" : undefined}
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") { setCurrentValue(value); setEditing(false); }
        }}
        className={`w-20 px-1.5 py-0.5 bg-workshop-bg border border-workshop-accent rounded text-sm text-workshop-text ${align === "left" ? "text-left" : "text-right"} focus:outline-none`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-workshop-accent/20 px-1.5 py-0.5 rounded transition-colors ${saving ? "opacity-50" : ""} ${className}`}
      title="Klicka för att redigera"
    >
      {currentValue}{suffix ? ` ${suffix}` : ""}
    </span>
  );
}
