import { db } from "@/lib/db";
import { workOrders, vehicles, customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { sendSms } from "@/lib/integrations/sms/client";
import {
  statusUpdateSms,
  approvalRequestSms,
  SMS_TRIGGER_STATUSES,
} from "@/lib/integrations/sms/templates";

/**
 * Notify customer of a work order status change.
 * Fire-and-forget: errors are logged but not thrown.
 */
export async function notifyStatusChange(
  workOrderId: string,
  newStatus: string,
): Promise<void> {
  try {
    // Only notify for specific statuses
    if (!SMS_TRIGGER_STATUSES.includes(newStatus)) return;

    // Fetch work order with customer phone
    const [data] = await db
      .select({
        orderNumber:  workOrders.orderNumber,
        vehicleRegNr: vehicles.regNr,
        customerPhone: customers.phone,
      })
      .from(workOrders)
      .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .where(eq(workOrders.id, workOrderId));

    if (!data?.customerPhone) {
      console.log(`[notify] No phone for work order ${workOrderId}, skipping SMS`);
      return;
    }

    const message = statusUpdateSms(data.orderNumber, newStatus, data.vehicleRegNr);
    await sendSms(data.customerPhone, message);

    console.log(`[notify] SMS sent for ${data.orderNumber} → ${newStatus}`);
  } catch (err) {
    console.error("[notify] Status change SMS failed:", err);
  }
}

/**
 * Notify customer about a new approval request via SMS.
 * Fire-and-forget.
 */
export async function notifyApprovalRequest(
  workOrderId: string,
  approvalUrl: string,
): Promise<void> {
  try {
    const [data] = await db
      .select({
        vehicleRegNr:    vehicles.regNr,
        customerPhone:   customers.phone,
        customerFirst:   customers.firstName,
        customerLast:    customers.lastName,
        customerCompany: customers.companyName,
      })
      .from(workOrders)
      .innerJoin(vehicles, eq(workOrders.vehicleId, vehicles.id))
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .where(eq(workOrders.id, workOrderId));

    if (!data?.customerPhone) {
      console.log(`[notify] No phone for approval, skipping SMS`);
      return;
    }

    const customerName = data.customerCompany ??
      [data.customerFirst, data.customerLast].filter(Boolean).join(" ") ?? "Kund";

    const message = approvalRequestSms(customerName, data.vehicleRegNr, approvalUrl);
    await sendSms(data.customerPhone, message);

    console.log(`[notify] Approval SMS sent for ${data.vehicleRegNr}`);
  } catch (err) {
    console.error("[notify] Approval SMS failed:", err);
  }
}
