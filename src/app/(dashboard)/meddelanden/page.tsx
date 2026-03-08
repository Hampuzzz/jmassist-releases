import { db } from "@/lib/db";
import { messageLogs, customers } from "@/lib/db/schemas";
import { desc, eq } from "drizzle-orm";
import { MessageLogList } from "./MessageLogList";

export const metadata = { title: "Meddelanden" };
export const dynamic = "force-dynamic";

export default async function MeddelandenPage() {
  const rows = await db
    .select({
      id: messageLogs.id,
      channel: messageLogs.channel,
      type: messageLogs.type,
      recipientPhone: messageLogs.recipientPhone,
      recipientEmail: messageLogs.recipientEmail,
      recipientName: messageLogs.recipientName,
      message: messageLogs.message,
      status: messageLogs.status,
      externalId: messageLogs.externalId,
      costSek: messageLogs.costSek,
      errorMessage: messageLogs.errorMessage,
      relatedEntityType: messageLogs.relatedEntityType,
      sentAt: messageLogs.sentAt,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerCompany: customers.companyName,
    })
    .from(messageLogs)
    .leftJoin(customers, eq(messageLogs.customerId, customers.id))
    .orderBy(desc(messageLogs.sentAt))
    .limit(200);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-workshop-text">Meddelanden</h1>
        <p className="text-sm text-workshop-muted">
          Logg över skickade SMS och e-post till kunder
        </p>
      </div>

      <MessageLogList
        initialMessages={rows.map((r) => ({
          ...r,
          sentAt: r.sentAt instanceof Date ? r.sentAt.toISOString() : String(r.sentAt),
        }))}
      />
    </div>
  );
}
