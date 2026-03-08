import { db } from "@/lib/db";
import { resources } from "@/lib/db/schemas";
import { asc } from "drizzle-orm";
import ResourcesManager from "@/components/installningar/ResourcesManager";

export const metadata = { title: "Resurser & Liftar" };
export const dynamic = "force-dynamic";

export default async function ResurserPage() {
  let data: any[] = [];
  try {
    data = await db
      .select()
      .from(resources)
      .orderBy(asc(resources.sortOrder));
  } catch (err) {
    console.error("[resurser] DB query failed:", err);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-workshop-text">Resurser & Liftar</h1>
      </div>

      <ResourcesManager initial={data} />
    </div>
  );
}
