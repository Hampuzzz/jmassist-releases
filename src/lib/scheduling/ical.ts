import { db } from "@/lib/db";
import { appointments, vehicles, customers } from "@/lib/db/schemas";
import { and, gte, lte, ne, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.ICAL_SECRET ?? "fallback-secret-change-in-production",
);

/**
 * Signs a short-lived token for iCal URL access.
 * The token embeds the user ID so the calendar is user-scoped.
 */
export async function signICalToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, scope: "ical" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret);
}

export async function verifyICalToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.scope !== "ical" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * Generates an iCal (.ics) string for all upcoming appointments.
 * Compatible with Google Calendar, Apple Calendar, Outlook.
 */
export async function generateICalFeed(startDate?: Date, endDate?: Date): Promise<string> {
  const from = startDate ?? new Date();
  const to = endDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const appts = await db
    .select({
      id:                 appointments.id,
      scheduledStart:     appointments.scheduledStart,
      scheduledEnd:       appointments.scheduledEnd,
      serviceDescription: appointments.serviceDescription,
      status:             appointments.status,
      customerNotes:      appointments.customerNotes,
      vehicleRegNr:       vehicles.regNr,
      vehicleBrand:       vehicles.brand,
      vehicleModel:       vehicles.model,
      customerName:       customers.firstName,
      customerLastName:   customers.lastName,
      customerCompany:    customers.companyName,
      customerPhone:      customers.phone,
    })
    .from(appointments)
    .innerJoin(vehicles, eq(appointments.vehicleId, vehicles.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        ne(appointments.status, "cancelled"),
        gte(appointments.scheduledStart, from),
        lte(appointments.scheduledStart, to),
      ),
    )
    .orderBy(appointments.scheduledStart);

  const workshopName = process.env.WORKSHOP_NAME ?? "Bilverkstad";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${workshopName}//Verkstads-ERP//SV`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${workshopName} - Bokningar`,
    "X-WR-TIMEZONE:Europe/Stockholm",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Stockholm",
    "END:VTIMEZONE",
  ];

  for (const appt of appts) {
    const customerDisplay =
      appt.customerCompany ??
      [appt.customerName, appt.customerLastName].filter(Boolean).join(" ");

    const summary = `${appt.vehicleRegNr} - ${appt.vehicleBrand} ${appt.vehicleModel}`;
    const description = [
      appt.serviceDescription ? `Tjänst: ${appt.serviceDescription}` : "",
      customerDisplay ? `Kund: ${customerDisplay}` : "",
      appt.customerPhone ? `Tel: ${appt.customerPhone}` : "",
      appt.customerNotes ? `Anteckning: ${appt.customerNotes}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    const dtStart = formatICalDate(new Date(appt.scheduledStart));
    const dtEnd = formatICalDate(new Date(appt.scheduledEnd));
    const uid = `${appt.id}@${appUrl.replace("https://", "").replace("http://", "")}`;

    const eventLines = [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;TZID=Europe/Stockholm:${dtStart}`,
      `DTEND;TZID=Europe/Stockholm:${dtEnd}`,
      `SUMMARY:${escapeIcal(summary)}`,
      description ? `DESCRIPTION:${escapeIcal(description)}` : "",
      `STATUS:${appt.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`,
      `URL:${appUrl}/kalender`,
      "END:VEVENT",
    ].filter((l) => l !== "");
    lines.push(...eventLines);
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

function formatICalDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "");
}

function escapeIcal(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
