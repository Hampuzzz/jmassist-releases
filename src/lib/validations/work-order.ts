import { z } from "zod";

export const createWorkOrderSchema = z.object({
  vehicleId:           z.string().uuid(),
  customerId:          z.string().uuid(),
  promisedAt:          z.string().datetime().optional().nullable().transform(val => val ? new Date(val) : null),
  mileageIn:           z.number().int().positive().optional().nullable(),
  customerComplaint:   z.string().max(2000).optional().nullable(),
  internalNotes:       z.string().max(2000).optional().nullable(),
  inspectionTemplateId: z.string().uuid().optional().nullable(),
  laborRateOverride:   z.number().positive().optional().nullable(),
});

export const updateWorkOrderSchema = createWorkOrderSchema.partial().extend({
  mileageOut:   z.number().int().positive().optional().nullable(),
});

export const updateWorkOrderStatusSchema = z.object({
  status: z.enum(["queued", "diagnosing", "ongoing", "ordering_parts", "waiting_for_parts", "ready_for_pickup", "finished", "cancelled"]),
});

export const createWorkOrderTaskSchema = z.object({
  description:    z.string().min(1).max(500),
  assignedTo:     z.string().uuid().optional().nullable(),
  estimatedHours: z.number().positive().optional().nullable(),
  sortOrder:      z.number().int().optional(),
});

export const addWorkOrderPartSchema = z.object({
  partId:        z.string().uuid(),
  quantity:      z.number().positive(),
  unitSellPrice: z.number().nonnegative().optional(),
  vmbEligible:   z.boolean().optional(),
  costBasis:     z.number().nonnegative().optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
});
