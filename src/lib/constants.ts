export const VAT_RATE = 0.25; // 25% Swedish standard VAT
export const VMB_FACTOR = 0.20; // 1/5 of margin = equivalent of 25% on margin ex tax

export const WORK_ORDER_STATUSES = {
  queued:            { label: "I kö",              color: "bg-zinc-700 text-zinc-200" },
  diagnosing:        { label: "Diagnostik",        color: "bg-purple-700 text-purple-100" },
  ongoing:           { label: "Pågående",          color: "bg-amber-600 text-amber-100" },
  ordering_parts:    { label: "Beställer delar",   color: "bg-cyan-700 text-cyan-100" },
  waiting_for_parts: { label: "Väntar på delar",   color: "bg-blue-700 text-blue-100" },
  ready_for_pickup:  { label: "Klar för hämtning", color: "bg-green-600 text-green-100" },
  finished:          { label: "Färdig",            color: "bg-green-800 text-green-200" },
  cancelled:         { label: "Avbruten",          color: "bg-red-800 text-red-200" },
} as const;

export type WorkOrderStatusKey = keyof typeof WORK_ORDER_STATUSES;

export const INVOICE_STATUSES = {
  draft:     { label: "Utkast",    color: "bg-zinc-700 text-zinc-200" },
  sent:      { label: "Skickad",   color: "bg-blue-700 text-blue-100" },
  paid:      { label: "Betald",    color: "bg-green-700 text-green-100" },
  overdue:   { label: "Förfallen", color: "bg-red-700 text-red-100" },
  cancelled: { label: "Annullerad", color: "bg-zinc-600 text-zinc-300" },
} as const;

export const APPOINTMENT_STATUSES = {
  pending:   { label: "Väntande",  color: "bg-yellow-700 text-yellow-100" },
  confirmed: { label: "Bekräftad", color: "bg-green-700 text-green-100" },
  cancelled: { label: "Avbokad",   color: "bg-red-800 text-red-200" },
  no_show:   { label: "Uteblev",   color: "bg-zinc-600 text-zinc-300" },
} as const;

export const DAY_NAMES: Record<number, string> = {
  1: "Måndag",
  2: "Tisdag",
  3: "Onsdag",
  4: "Torsdag",
  5: "Fredag",
  6: "Lördag",
  7: "Söndag",
};

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  queued:            ["diagnosing", "ongoing", "cancelled"],
  diagnosing:        ["ongoing", "ordering_parts", "waiting_for_parts", "queued", "cancelled"],
  ongoing:           ["waiting_for_parts", "ordering_parts", "ready_for_pickup", "finished", "queued"],
  ordering_parts:    ["waiting_for_parts", "ongoing", "cancelled"],
  waiting_for_parts: ["ongoing", "cancelled"],
  ready_for_pickup:  ["finished", "ongoing"],
  finished:          [],
  cancelled:         ["queued"],
};

export const VALID_INVOICE_TRANSITIONS: Record<string, string[]> = {
  draft:     ["sent", "cancelled"],
  sent:      ["paid", "overdue", "cancelled"],
  paid:      [],
  overdue:   ["paid", "cancelled"],
  cancelled: [],
};

export const LINE_ITEM_TYPES = {
  labor:    { label: "Arbete",   unit: "tim" },
  part:     { label: "Del",      unit: "st" },
  misc:     { label: "Övrigt",   unit: "st" },
  fee:      { label: "Avgift",   unit: "st" },
  discount: { label: "Rabatt",   unit: "st" },
} as const;

export const SLOT_DURATION_MINUTES = 60;
export const ICAL_TOKEN_EXPIRY_HOURS = 24 * 365;

export const WORKSHOP_HOURLY_RATE = parseInt(process.env.WORKSHOP_HOURLY_RATE ?? "850");
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "JM Assist";
