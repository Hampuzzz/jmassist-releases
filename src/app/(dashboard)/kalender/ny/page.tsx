import { db } from "@/lib/db";
import { resources } from "@/lib/db/schemas";
import { eq, asc } from "drizzle-orm";
import NewBookingForm from "@/components/kalender/NewBookingForm";

export const metadata = { title: "Ny bokning" };
export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  let resourceList: any[] = [];

  try {
    resourceList = await db
      .select({ id: resources.id, name: resources.name, resourceType: resources.resourceType })
      .from(resources)
      .where(eq(resources.isActive, true))
      .orderBy(asc(resources.sortOrder));
  } catch (err) {
    console.error("[kalender/ny] DB query failed:", err);
  }

  return (
    <NewBookingForm
      resources={resourceList}
      preselectedDate={searchParams.date}
    />
  );
}
