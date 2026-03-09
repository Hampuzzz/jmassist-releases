import { z } from "zod";

export const createVehicleSchema = z.object({
  customerId:   z.string().uuid().optional().nullable(),
  regNr:        z.string().min(2).max(10).transform((v) => v.toUpperCase().replace(/[\s-]/g, "")),
  vin:          z.string().length(17).optional().nullable(),
  brand:        z.string().min(1).max(100),
  model:        z.string().min(1).max(100),
  modelYear:    z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  color:        z.string().max(50).optional().nullable(),
  fuelType:     z.enum(["petrol", "diesel", "hybrid", "electric", "plug_in_hybrid", "ethanol", "lpg", "hydrogen", "other"]).optional().nullable(),
  engineSizeCc: z.number().int().positive().optional().nullable(),
  powerKw:      z.number().int().positive().optional().nullable(),
  engineCode:   z.string().max(30).optional().nullable(),
  transmission: z.enum(["manual", "automatic"]).optional().nullable(),
  driveType:    z.enum(["fwd", "rwd", "awd"]).optional().nullable(),
  mileageKm:    z.number().int().nonnegative().optional().nullable(),
  notes:        z.string().max(1000).optional().nullable(),
});

export const updateVehicleSchema = createVehicleSchema.partial();
