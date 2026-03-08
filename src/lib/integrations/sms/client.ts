import { db } from "@/lib/db";
import { messageLogs } from "@/lib/db/schemas";
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

export type SmsLogContext = {
  type?: string;
  customerId?: string;
  recipientName?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

/**
 * Send an SMS via 46elks.
 * Returns the SMS response or null if in mock mode.
 * Always logs the message to the message_logs table.
 */
export async function sendSms(
  to: string,
  message: string,
  context?: SmsLogContext,
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

    // Log mock SMS
    try {
      await db.insert(messageLogs).values({
        channel: "sms",
        type: context?.type ?? "manual",
        recipientPhone: formattedTo,
        recipientName: context?.recipientName ?? null,
        customerId: context?.customerId ?? null,
        message,
        status: "mock",
        relatedEntityType: context?.relatedEntityType ?? null,
        relatedEntityId: context?.relatedEntityId ?? null,
      });
    } catch (logErr) {
      console.error("[sms] Failed to log mock SMS:", logErr);
    }

    return null;
  }

  const body = new URLSearchParams({
    from: SENDER,
    to: formattedTo,
    message,
  });

  try {
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

      // Log failed SMS
      try {
        await db.insert(messageLogs).values({
          channel: "sms",
          type: context?.type ?? "manual",
          recipientPhone: formattedTo,
          recipientName: context?.recipientName ?? null,
          customerId: context?.customerId ?? null,
          message,
          status: "failed",
          errorMessage: `${res.status}: ${errText}`,
          relatedEntityType: context?.relatedEntityType ?? null,
          relatedEntityId: context?.relatedEntityId ?? null,
        });
      } catch (logErr) {
        console.error("[sms] Failed to log failed SMS:", logErr);
      }

      throw new Error(`SMS-fel: ${res.status} ${errText}`);
    }

    const smsResponse = (await res.json()) as SmsResponse;

    // Log successful SMS
    try {
      await db.insert(messageLogs).values({
        channel: "sms",
        type: context?.type ?? "manual",
        recipientPhone: formattedTo,
        recipientName: context?.recipientName ?? null,
        customerId: context?.customerId ?? null,
        message,
        status: "sent",
        externalId: smsResponse.id,
        costSek: smsResponse.cost,
        relatedEntityType: context?.relatedEntityType ?? null,
        relatedEntityId: context?.relatedEntityId ?? null,
      });
    } catch (logErr) {
      console.error("[sms] Failed to log sent SMS:", logErr);
    }

    return smsResponse;
  } catch (err) {
    if ((err as Error).message.startsWith("SMS-fel:")) throw err;

    // Log network error
    try {
      await db.insert(messageLogs).values({
        channel: "sms",
        type: context?.type ?? "manual",
        recipientPhone: formattedTo,
        recipientName: context?.recipientName ?? null,
        customerId: context?.customerId ?? null,
        message,
        status: "failed",
        errorMessage: (err as Error).message,
        relatedEntityType: context?.relatedEntityType ?? null,
        relatedEntityId: context?.relatedEntityId ?? null,
      });
    } catch (logErr) {
      console.error("[sms] Failed to log error SMS:", logErr);
    }

    throw err;
  }
}
