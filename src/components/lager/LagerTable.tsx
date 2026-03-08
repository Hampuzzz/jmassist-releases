"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { EditableCell } from "./EditableCell";

interface Part {
  id: string;
  partNumber: string;
  name: string;
  category: string | null;
  costPrice: string;
  sellPrice: string;
  stockQty: string;
  stockMinQty: string;
  stockLocation: string | null;
  markupPct: string | null;
  unit: string | null;
}

export function LagerTable({ data: initialData }: { data: Part[] }) {
  const [data, setData] = useState(initialData);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/lager/${id}`, { method: "DELETE" });
      if (res.ok) {
        setData((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // ignore
    }
    setDeleting(null);
  }

  return (
    <div className="surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-workshop-border bg-workshop-elevated">
            <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Artikelnr</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Benämning</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Kategori</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase">Lagersaldo</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Inköpspris</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Försäljningspris</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">Pålägg</th>
            <th className="px-3 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => {
            const minQty = parseFloat(p.stockMinQty);
            const isLow = minQty > 0 && parseFloat(p.stockQty) <= minQty;
            const isConfirming = deleting === p.id;
            return (
              <tr key={p.id} className={`border-b border-workshop-border hover:bg-workshop-elevated/50 ${isConfirming ? "bg-red-900/10" : ""}`}>
                <td className="px-4 py-3 font-mono text-workshop-muted text-xs">{p.partNumber}</td>
                <td className="px-4 py-3">
                  <Link href={`/lager/${p.id}`} className="hover:text-workshop-accent">
                    <p className="font-medium text-workshop-text">{p.name}</p>
                  </Link>
                </td>
                <td className="px-4 py-3 text-workshop-muted hidden md:table-cell">{p.category ?? "–"}</td>
                <td className="px-4 py-3 text-right">
                  <span className={isLow ? "text-red-400" : ""}>
                    <EditableCell
                      value={p.stockQty}
                      partId={p.id}
                      field="stockQty"
                      suffix={p.unit ?? "st"}
                      className={`font-mono ${isLow ? "text-red-400" : "text-workshop-text"}`}
                    />
                  </span>
                  {isLow && <AlertTriangle className="inline h-3 w-3 text-red-400 ml-1" />}
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <EditableCell
                    value={p.costPrice}
                    partId={p.id}
                    field="costPrice"
                    suffix="kr"
                    className="font-mono text-workshop-muted"
                  />
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <EditableCell
                    value={p.sellPrice}
                    partId={p.id}
                    field="sellPrice"
                    suffix="kr"
                    className="font-mono text-workshop-text"
                  />
                </td>
                <td className="px-4 py-3 text-right text-workshop-muted hidden lg:table-cell">
                  {p.markupPct ? `${parseFloat(p.markupPct).toFixed(0)}%` : "–"}
                </td>
                <td className="px-3 py-3">
                  {isConfirming ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
                        title="Bekräfta radering"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(null)}
                        className="p-1 text-workshop-muted hover:text-workshop-text hover:bg-workshop-elevated rounded"
                        title="Avbryt"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleting(p.id)}
                      className="p-1 text-workshop-muted/40 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                      title="Ta bort artikel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {data.length === 0 && (
        <p className="text-center text-workshop-muted py-8 text-sm">Inga artiklar hittades</p>
      )}
    </div>
  );
}
