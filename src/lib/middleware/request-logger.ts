import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { bookingRequestLog } from "@/lib/db/schemas";

export interface LogEntryInput {
  request: NextRequest;
  endpoint: string;
  apiKeyId?: string;
  responseStatus: number;
  appointmentId?: string;
  requestBody?: unknown;
}

/**
 * Logs an external API request to the booking_request_log table.
 * Runs asynchronously - does not block the response.
 */
export async function logExternalRequest(entry: LogEntryInput): Promise<void> {
  const origin = entry.request.headers.get("origin");
  const ip =
    entry.request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    entry.request.headers.get("x-real-ip") ??
    "unknown";

  // Always log to console when we receive an external request
  const timestamp = new Date().toISOString();
  const statusEmoji = entry.responseStatus < 400 ? "✓" : "✗";
  console.log(
    `[${timestamp}] ${statusEmoji} EXTERN FÖRFRÅGAN | ${entry.endpoint} | Status: ${entry.responseStatus} | Ursprung: ${origin ?? "okänd"} | IP: ${ip}`,
  );

  // Write to DB (fire and forget)
  db.insert(bookingRequestLog)
    .values({
      endpoint:       entry.endpoint,
      method:         entry.request.method,
      origin:         origin,
      ipAddress:      ip,
      apiKeyId:       entry.apiKeyId ?? null,
      requestBody:    entry.requestBody ? (entry.requestBody as Record<string, unknown>) : null,
      responseStatus: entry.responseStatus,
      appointmentId:  entry.appointmentId ?? null,
    })
    .catch((err) => {
      console.error("[request-logger] Failed to write log:", err);
    });
}
