import type { SmsResponse } from "./types";

// ─── Configuration ─────────────────────────────────────────────────────────

const API_URL = "https://api.46elks.com/a1/sms";
const API_USERNAME = process.env.ELKS_API_USERNAME ?? "";
const API_PASSWORD = process.env.ELKS_API_PASSWORD ?? "";
const SENDER = process.env.ELKS_SENDER ?? "JMAssist";

export function isSmsEnabled(): boolean {
  return API_USERNAME.length > 0 && API_PASSWORD.length > 0;
}

/**
 * Format a Swedish phone number to E.164 format (+46...).
 * Handles: 070-123 45 67, 0701234567, +46701234567, etc.
 */
export function formatPhoneE164(phone: string): string | null {
  // Strip everything except digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+46")) {
    return cleaned.length >= 12 ? cleaned : null;
  }
  if (cleaned.startsWith("46") && cleaned.length >= 11) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("0") && cleaned.length >= 10) {
    return `+46${cleaned.slice(1)}`;
  }

  return null; // Can't parse
}

/**
 * Send an SMS via 46elks.
 * Returns the SMS response or null if in mock mode.
 */
export async function sendSms(
  to: string,
  message: string,
): Promise<SmsResponse | null> {
  const formattedTo = formatPhoneE164(to);
  if (!formattedTo) {
    console.warn(`[sms] Invalid phone number: ${to}`);
    return null;
  }

  if (!isSmsEnabled()) {
    console.log(`[sms:mock] To: ${formattedTo}`);
    console.log(`[sms:mock] Message: ${message}`);
    console.log(`[sms:mock] From: ${SENDER}`);
    return null;
  }

  const body = new URLSearchParams({
    from: SENDER,
    to: formattedTo,
    message,
  });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[sms] 46elks API error (${res.status}):`, errText);
    throw new Error(`SMS-fel: ${res.status} ${errText}`);
  }

  return (await res.json()) as SmsResponse;
}
