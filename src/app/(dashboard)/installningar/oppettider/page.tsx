import { db } from "@/lib/db";
import { openingHours, blockedPeriods } from "@/lib/db/schemas";
import { asc } from "drizzle-orm";
import OpeningHoursForm from "@/components/installningar/OpeningHoursForm";
import BlockedPeriodForm from "@/components/installningar/BlockedPeriodForm";

export const metadata = { title: "Öppettider" };
export const dynamic = "force-dynamic";

export default async function OppettiderPage() {
  let hours: any[] = [];
  let blocks: any[] = [];
  try {
    hours  = await db.select().from(openingHours).orderBy(asc(openingHours.dayOfWeek));
    blocks = await db.select().from(blockedPeriods).orderBy(asc(blockedPeriods.blockStart));
  } catch (err) {
    console.error("[oppettider] DB query failed:", err);
  }

  // Serialize dates for client components
  const serializedBlocks = blocks.map((b) => ({
    id: b.id,
    title: b.title,
    blockStart: b.blockStart instanceof Date ? b.blockStart.toISOString() : String(b.blockStart),
    blockEnd: b.blockEnd instanceof Date ? b.blockEnd.toISOString() : String(b.blockEnd),
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-workshop-text">Öppettider</h1>

      <OpeningHoursForm initial={hours} />

      <BlockedPeriodForm blocks={serializedBlocks} />
    </div>
  );
}
