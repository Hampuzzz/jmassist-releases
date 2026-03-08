import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistance } from "date-fns";
import { sv } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null, fmt = "d MMM yyyy"): string {
  if (!date) return "–";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "–";
    return format(d, fmt, { locale: sv });
  } catch {
    return "–";
  }
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "–";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "–";
    return format(d, "d MMM yyyy HH:mm", { locale: sv });
  } catch {
    return "–";
  }
}

export function formatRelative(date: Date | string | null): string {
  if (!date) return "–";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "–";
    return formatDistance(d, new Date(), { addSuffix: true, locale: sv });
  } catch {
    return "–";
  }
}

export function formatCurrency(amount: number | string | null, currency = "SEK"): string {
  if (amount === null || amount === undefined) return "–";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(num: number | string | null, decimals = 0): string {
  if (num === null || num === undefined) return "–";
  const n = typeof num === "string" ? parseFloat(num) : num;
  return new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function regNrNormalize(regNr: string): string {
  return regNr.toUpperCase().replace(/[\s-]/g, "");
}

export function generateApiKey(): { key: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = "wks_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  const prefix = key.slice(0, 12);
  return { key, prefix };
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
