import { z } from "zod";

const appointmentBaseSchema = z.object({
  vehicleId:          z.string().uuid(),
  customerId:         z.string().uuid(),
  resourceId:         z.string().uuid().optional().nullable(),
  mechanicId:         z.string().uuid().optional().nullable(),
  workOrderId:        z.string().uuid().optional().nullable(),
  scheduledStart:     z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)]).transform(val => new Date(val)),
  scheduledEnd:       z.union([z.string().datetime(), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)]).transform(val => new Date(val)),
  serviceDescription: z.string().max(500).optional().nullable(),
  customerNotes:      z.string().max(1000).optional().nullable(),
  internalNotes:      z.string().max(1000).optional().nullable(),
  status:             z.enum(["confirmed", "pending", "cancelled", "no_show"]).optional(),
});

export const createAppointmentSchema = appointmentBaseSchema.refine(
  (data) => new Date(data.scheduledEnd) > new Date(data.scheduledStart),
  { message: "Sluttiden måste vara efter starttiden", path: ["scheduledEnd"] },
);

export const updateAppointmentSchema = appointmentBaseSchema.partial();

export const externalBookingSchema = z.object({
  // Vehicle identification
  regNr:          z.string().min(2).max(10),
  // Customer
  customerName:   z.string().min(1).max(200),
  customerPhone:  z.string().min(1).max(30),
  customerEmail:  z.string().email().optional(),
  // Booking
  requestedDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Måste vara YYYY-MM-DD"),
  requestedTime:  z.string().regex(/^\d{2}:\d{2}$/, "Måste vara HH:MM").optional(),
  serviceType:    z.string().max(200).optional(),
  notes:          z.string().max(1000).optional(),
  // Duration in minutes (default 60)
  durationMinutes: z.number().int().min(15).max(480).default(60),
});

export type ExternalBookingInput = z.infer<typeof externalBookingSchema>;
