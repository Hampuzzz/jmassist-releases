/**
 * Swedish SMS templates for workshop notifications.
 * All templates should be under 160 chars (1 SMS segment).
 */

const WORKSHOP_NAME = process.env.WORKSHOP_NAME ?? process.env.NEXT_PUBLIC_APP_NAME ?? "Verkstaden";

/** Status labels in Swedish */
const STATUS_LABELS: Record<string, string> = {
  queued:              "mottagen",
  diagnosing:          "under diagnos",
  ongoing:             "p\u00e5g\u00e5r",
  ordering_parts:      "best\u00e4ller delar",
  waiting_for_parts:   "v\u00e4ntar p\u00e5 delar",
  ready_for_pickup:    "klar f\u00f6r avh\u00e4mtning",
  finished:            "avslutad",
  cancelled:           "avbokad",
};

/**
 * Status change notification.
 * Sent when a work order status changes to certain key states.
 */
export function statusUpdateSms(
  orderNumber: string,
  newStatus: string,
  vehicleRegNr?: string,
): string {
  const statusLabel = STATUS_LABELS[newStatus] ?? newStatus;
  const vehicle = vehicleRegNr ? ` (${vehicleRegNr})` : "";

  if (newStatus === "ready_for_pickup") {
    return `${WORKSHOP_NAME}: Din bil${vehicle} \u00e4r klar f\u00f6r avh\u00e4mtning! Order ${orderNumber}. V\u00e4lkommen!`;
  }

  if (newStatus === "finished") {
    return `${WORKSHOP_NAME}: Arbete p\u00e5 din bil${vehicle} \u00e4r klart. Order ${orderNumber}. Tack f\u00f6r f\u00f6rtroendet!`;
  }

  return `${WORKSHOP_NAME}: Din order ${orderNumber}${vehicle} har ny status: ${statusLabel}.`;
}

/**
 * Approval request — sends link to customer for repair approval.
 */
export function approvalRequestSms(
  customerName: string,
  vehicleRegNr: string,
  approvalUrl: string,
): string {
  const first = customerName.split(" ")[0];
  return `Hej ${first}! Vi har hittat punkter p\u00e5 ${vehicleRegNr} som beh\u00f6ver \u00e5tg\u00e4rdas. Godk\u00e4nn h\u00e4r: ${approvalUrl} //${WORKSHOP_NAME}`;
}

/**
 * Service reminder — proactive maintenance notification.
 */
export function serviceReminderSms(
  customerName: string,
  vehicleRegNr: string,
  date: string,
): string {
  const first = customerName.split(" ")[0];
  return `Hej ${first}! Dags f\u00f6r service p\u00e5 ${vehicleRegNr}. Boka ${date} eller ring oss. //${WORKSHOP_NAME}`;
}

/**
 * Appointment confirmation.
 */
export function appointmentConfirmationSms(
  date: string,
  time: string,
): string {
  return `${WORKSHOP_NAME}: Din bokning \u00e4r bekr\u00e4ftad ${date} kl ${time}. V\u00e4lkommen!`;
}

/**
 * VHC report — sends link to customer to view health check results.
 */
export function vhcReportSms(
  customerName: string,
  vehicleRegNr: string,
  checkupUrl: string,
): string {
  const first = customerName.split(" ")[0];
  return `Hej ${first}! Vi har gjort en hälsokontroll på ${vehicleRegNr}. Se resultatet: ${checkupUrl} //${WORKSHOP_NAME}`;
}

/**
 * Inspection reminder — vehicle due for mandatory inspection.
 */
export function inspectionReminderSms(
  customerName: string,
  vehicleRegNr: string,
  dueDate: string,
): string {
  const first = customerName.split(" ")[0];
  return `Hej ${first}! ${vehicleRegNr} ska besiktigas senast ${dueDate}. Boka tid hos oss! //${WORKSHOP_NAME}`;
}

/**
 * Tire change reminder — seasonal tire swap.
 */
export function tireChangeReminderSms(
  customerName: string,
  vehicleRegNr: string,
): string {
  const first = customerName.split(" ")[0];
  return `Hej ${first}! Dags för däckbyte på ${vehicleRegNr}. Boka tid: ring oss eller svara på detta SMS. //${WORKSHOP_NAME}`;
}

/** Statuses that should trigger SMS notifications */
export const SMS_TRIGGER_STATUSES = [
  "ready_for_pickup",
  "finished",
];
