import { db } from "@/lib/db";
import { crmReminders, customers, vehicles } from "@/lib/db/schemas";
import { eq, desc } from "drizzle-orm";
import { CrmDashboard } from "./CrmDashboard";

export default async function CrmPage() {
  const reminders = await db
    .select({
      id: crmReminders.id,
      type: crmReminders.type,
      title: crmReminders.title,
      message: crmReminders.message,
      dueDate: crmReminders.dueDate,
      status: crmReminders.status,
      sentAt: crmReminders.sentAt,
      createdAt: crmReminders.createdAt,
      customerName: customers.firstName,
      customerLast: customers.lastName,
      companyName: customers.companyName,
      phone: customers.phone,
      regNr: vehicles.regNr,
      brand: vehicles.brand,
      model: vehicles.model,
    })
    .from(crmReminders)
    .leftJoin(customers, eq(crmReminders.customerId, customers.id))
    .leftJoin(vehicles, eq(crmReminders.vehicleId, vehicles.id))
    .orderBy(desc(crmReminders.createdAt))
    .limit(200);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-workshop-text">CRM & Påminnelser</h1>
          <p className="text-sm text-workshop-muted">Proaktiv kundbearbetning — service, besiktning, däckbyte</p>
        </div>
      </div>

      <CrmDashboard initialReminders={reminders.map((r) => ({
        ...r,
        sentAt: r.sentAt ? (r.sentAt instanceof Date ? r.sentAt.toISOString() : String(r.sentAt)) : null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      }))} />
    </div>
  );
}
