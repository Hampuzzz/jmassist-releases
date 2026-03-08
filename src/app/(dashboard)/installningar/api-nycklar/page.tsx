import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schemas";
import { desc } from "drizzle-orm";
import { formatDateTime } from "@/lib/utils";
import { Key, Plus } from "lucide-react";

export const metadata = { title: "API-nycklar" };
export const dynamic = "force-dynamic";

export default async function ApiNyklarPage() {
  let keys: any[] = [];
  try {
    keys = await db
      .select()
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt));
  } catch (err) {
    console.error("[api-nycklar] DB query failed:", err);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">API-nycklar</h1>
          <p className="text-workshop-muted text-sm">
            Nycklar för externa bokningssystem och din webbplats
          </p>
        </div>
      </div>

      <div className="surface p-4 bg-amber-950/20 border border-amber-900/50">
        <p className="text-sm text-amber-300">
          <span className="font-semibold">Skapa ny nyckel:</span> Kör SQL-skriptet från README.md
          mot din Supabase-databas. API-nycklar visas aldrig i klartext efter att de skapats.
        </p>
      </div>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-workshop-border bg-workshop-elevated">
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Namn</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Prefix</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden md:table-cell">Behörigheter</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase hidden lg:table-cell">Senast använd</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-workshop-muted uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-workshop-border hover:bg-workshop-elevated/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-workshop-muted" />
                    <span className="font-medium text-workshop-text">{k.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-workshop-muted">
                  {k.keyPrefix}•••••••••
                </td>
                <td className="px-4 py-3 text-workshop-muted text-xs hidden md:table-cell">
                  {k.scopes?.join(", ") ?? "–"}
                </td>
                <td className="px-4 py-3 text-workshop-muted hidden lg:table-cell text-xs">
                  {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Aldrig"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    k.isActive
                      ? "bg-green-900/40 text-green-300"
                      : "bg-zinc-700 text-zinc-400"
                  }`}>
                    {k.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {keys.length === 0 && (
          <div className="py-8 text-center space-y-2">
            <Key className="h-8 w-8 text-workshop-muted mx-auto" />
            <p className="text-workshop-muted text-sm">Inga API-nycklar skapade</p>
            <p className="text-xs text-workshop-muted">
              Se README.md för instruktioner om hur du skapar en nyckel
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
