"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeleteButtonProps {
  id: string;
  endpoint: string;
  confirmMessage: string;
  onDeleteUrl?: string;
}

export default function DeleteButton({
  id,
  endpoint,
  confirmMessage,
}: DeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.error ?? "Något gick fel vid borttagning.";
        alert(msg);
        return;
      }
      router.refresh();
    } catch {
      alert("Nätverksfel — kunde inte ta bort.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      title="Ta bort"
      className="p-1.5 rounded text-red-400 hover:bg-red-900/30 hover:text-red-300
                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
