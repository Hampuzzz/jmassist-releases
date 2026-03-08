import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/middleware/api-key";
import { logExternalRequest } from "@/lib/middleware/request-logger";
import { getCorsHeaders } from "@/lib/middleware/cors";
import { db } from "@/lib/db";
import { appointments, vehicles, customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { externalBookingSchema } from "@/lib/validations/appointment";
import { getAvailability } from "@/lib/scheduling/availability";
import { checkResourceConflict } from "@/lib/scheduling/conflicts";
import { regNrNormalize } from "@/lib/utils";
import { addMinutes, parse, startOfDay } from "date-fns";

/**
 * POST /api/book
 *
 * External booking endpoint. Requires a valid API key in:
 *   Authorization: Bearer <key>
 *   OR X-API-Key: <key>
 *
 * Body: ExternalBookingInput (see validations/appointment.ts)
 *
 * Behavior:
 * 1. Validates API key
 * 2. Validates request body
 * 3. Finds or creates customer/vehicle records
 * 4. Finds next available slot on requested date
 * 5. Creates appointment
 * 6. Logs the request
 */
export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  // Validate API key
  const apiKeyResult = await validateApiKey(request, "booking:write");
  if (!apiKeyResult.valid) {
    await logExternalRequest({
      request,
      endpoint:       "/api/book",
      responseStatus: 401,
    });
    return NextResponse.json(
      { error: apiKeyResult.error ?? "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400, headers: corsHeaders });
  }

  const parsed = externalBookingSchema.safeParse(rawBody);
  if (!parsed.success) {
    await logExternalRequest({
      request,
      endpoint:       "/api/book",
      apiKeyId:       apiKeyResult.apiKeyId,
      responseStatus: 400,
      requestBody:    rawBody,
    });
    return NextResponse.json(
      { error: "Valideringsfel", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders },
    );
  }

  const input = parsed.data;
  const normalizedRegNr = regNrNormalize(input.regNr);

  // Find or stub vehicle
  let [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.regNr, normalizedRegNr));

  if (!vehicle) {
    // Create a stub vehicle - will be completed by staff
    [vehicle] = await db
      .insert(vehicles)
      .values({
        regNr:  normalizedRegNr,
        brand:  "Okänd",
        model:  "Okänd",
        notes:  "Skapad via onlinebokning - behöver uppdateras",
      })
      .returning();
  }

  // Find or create customer (match by phone number)
  let [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, input.customerPhone));

  if (!customer) {
    const nameParts = input.customerName.split(" ");
    const lastName  = nameParts.length > 1 ? nameParts.pop()! : undefined;
    const firstName = nameParts.join(" ");

    [customer] = await db
      .insert(customers)
      .values({
        isCompany: false,
        firstName,
        lastName,
        phone:  input.customerPhone,
        email:  input.customerEmail,
        notes:  "Skapad via onlinebokning",
      })
      .returning();
  }

  // Find available slot on requested date
  const requestedDate = parse(input.requestedDate, "yyyy-MM-dd", new Date());
  const availability  = await getAvailability(1, input.durationMinutes, requestedDate);
  const dayAvail      = availability[0];

  if (!dayAvail || !dayAvail.isOpen || dayAvail.slots.length === 0) {
    await logExternalRequest({
      request,
      endpoint:       "/api/book",
      apiKeyId:       apiKeyResult.apiKeyId,
      responseStatus: 409,
      requestBody:    rawBody,
    });
    return NextResponse.json(
      { error: "Inga lediga tider på begärt datum" },
      { status: 409, headers: corsHeaders },
    );
  }

  // Find the slot closest to requested time, or first available
  let selectedSlot = dayAvail.slots[0];
  if (input.requestedTime) {
    const requestedDateTime = parse(
      `${input.requestedDate} ${input.requestedTime}`,
      "yyyy-MM-dd HH:mm",
      new Date(),
    );
    const closest = dayAvail.slots.reduce((best, slot) => {
      const slotTime = new Date(slot.start);
      const bestTime = new Date(best.start);
      return Math.abs(slotTime.getTime() - requestedDateTime.getTime()) <
             Math.abs(bestTime.getTime() - requestedDateTime.getTime())
        ? slot
        : best;
    });
    selectedSlot = closest;
  }

  // Create the appointment
  const [appointment] = await db
    .insert(appointments)
    .values({
      vehicleId:          vehicle.id,
      customerId:         customer.id,
      resourceId:         selectedSlot.resourceId,
      scheduledStart:     new Date(selectedSlot.start),
      scheduledEnd:       new Date(selectedSlot.end),
      source:             "website",
      status:             "pending",
      serviceDescription: input.serviceType,
      customerNotes:      input.notes,
    })
    .returning();

  await logExternalRequest({
    request,
    endpoint:       "/api/book",
    apiKeyId:       apiKeyResult.apiKeyId,
    responseStatus: 201,
    requestBody:    rawBody,
    appointmentId:  appointment.id,
  });

  return NextResponse.json(
    {
      data: {
        appointmentId:  appointment.id,
        scheduledStart: appointment.scheduledStart,
        scheduledEnd:   appointment.scheduledEnd,
        resourceName:   selectedSlot.resourceName,
        status:         appointment.status,
        message:        "Din bokning är mottagen och väntar på bekräftelse.",
      },
    },
    { status: 201, headers: corsHeaders },
  );
}
