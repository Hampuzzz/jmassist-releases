import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { customers, vehicles } from "@/lib/db/schemas";
import { eq, sql } from "drizzle-orm";

interface VehicleInfo {
  regNr: string;
  mk: string;
  brand: string;
}

interface ImportCustomer {
  name: string;
  companyName?: string;
  isCompany: boolean;
  phone?: string;
  email?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  orgNr?: string;
  vehicles: VehicleInfo[];
}

interface ImportResult {
  created: number;
  skippedDuplicates: number;
  linkedVehicles: number;
  errors: string[];
}

const INSERT_BATCH = 500;

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Support both old format (rows[]) and new format (customers[])
  const importCustomers: ImportCustomer[] = body.customers ?? [];

  if (!Array.isArray(importCustomers) || importCustomers.length === 0) {
    return NextResponse.json(
      { error: "Inga kunder att importera." },
      { status: 400 },
    );
  }

  if (importCustomers.length > 5000) {
    return NextResponse.json(
      { error: "Max 5000 kunder per import." },
      { status: 400 },
    );
  }

  const result: ImportResult = {
    created: 0,
    skippedDuplicates: 0,
    linkedVehicles: 0,
    errors: [],
  };

  try {
    // ─── Step 1: Pre-load ALL existing phones and emails (2 queries) ───
    const [existingPhones, existingEmails] = await Promise.all([
      db
        .select({ id: customers.id, phone: customers.phone })
        .from(customers)
        .where(
          sql`${customers.phone} IS NOT NULL AND ${customers.phone} != ''`,
        ),
      db
        .select({ id: customers.id, email: customers.email })
        .from(customers)
        .where(
          sql`${customers.email} IS NOT NULL AND ${customers.email} != ''`,
        ),
    ]);

    const phoneToId = new Map<string, string>();
    for (const row of existingPhones) {
      if (row.phone) {
        const cleaned = row.phone.replace(/[\s-]/g, "").toLowerCase();
        if (cleaned) phoneToId.set(cleaned, row.id);
      }
    }

    const emailToId = new Map<string, string>();
    for (const row of existingEmails) {
      if (row.email) {
        emailToId.set(row.email.trim().toLowerCase(), row.id);
      }
    }

    // ─── Step 2: Pre-load ALL existing vehicle regNrs (1 query) ───
    const existingVehicles = await db
      .select({
        id: vehicles.id,
        regNr: vehicles.regNr,
        customerId: vehicles.customerId,
      })
      .from(vehicles);

    const vehicleMap = new Map<
      string,
      { id: string; customerId: string | null }
    >();
    for (const v of existingVehicles) {
      vehicleMap.set(v.regNr.toUpperCase(), {
        id: v.id,
        customerId: v.customerId,
      });
    }

    // ─── Step 3: Classify in-memory ───
    type NewCustomerInsert = {
      isCompany: boolean;
      firstName: string | null;
      lastName: string | null;
      companyName: string | null;
      phone: string | null;
      email: string | null;
      addressLine1: string | null;
      postalCode: string | null;
      city: string | null;
      orgNr: string | null;
      _vehicles: VehicleInfo[];
      _rowIndex: number;
    };

    const newCustomerRows: NewCustomerInsert[] = [];
    const duplicateVehicleLinks: {
      customerId: string;
      vehicles: VehicleInfo[];
    }[] = [];

    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    for (let i = 0; i < importCustomers.length; i++) {
      const c = importCustomers[i];

      try {
        let existingId: string | undefined;

        // Check duplicate by phone
        if (c.phone) {
          const cleanPhone = c.phone.replace(/[\s-]/g, "").toLowerCase();
          if (cleanPhone) {
            existingId = phoneToId.get(cleanPhone);
            if (!existingId && seenPhones.has(cleanPhone)) {
              result.skippedDuplicates++;
              continue;
            }
          }
        }

        // Check duplicate by email
        if (!existingId && c.email) {
          const cleanEmail = c.email.trim().toLowerCase();
          if (cleanEmail) {
            existingId = emailToId.get(cleanEmail);
            if (!existingId && seenEmails.has(cleanEmail)) {
              result.skippedDuplicates++;
              continue;
            }
          }
        }

        if (existingId) {
          result.skippedDuplicates++;
          if (c.vehicles && c.vehicles.length > 0) {
            duplicateVehicleLinks.push({
              customerId: existingId,
              vehicles: c.vehicles,
            });
          }
          continue;
        }

        // Parse name into firstName/lastName
        let firstName: string | null = null;
        let lastName: string | null = null;
        let companyName: string | null = null;

        if (c.isCompany) {
          companyName = c.companyName || c.name || null;
        } else {
          const parts = (c.name || "").trim().split(/\s+/);
          firstName = parts[0] || null;
          lastName = parts.slice(1).join(" ") || null;
        }

        const phoneVal = c.phone?.trim() || null;
        const emailVal = c.email?.trim() || null;

        newCustomerRows.push({
          isCompany: c.isCompany,
          firstName,
          lastName,
          companyName,
          phone: phoneVal,
          email: emailVal,
          addressLine1: c.street?.trim() || null,
          postalCode: c.postalCode?.trim() || null,
          city: c.city?.trim() || null,
          orgNr: c.orgNr?.trim() || null,
          _vehicles: c.vehicles || [],
          _rowIndex: i,
        });

        if (phoneVal)
          seenPhones.add(phoneVal.replace(/[\s-]/g, "").toLowerCase());
        if (emailVal) seenEmails.add(emailVal.toLowerCase());
      } catch (err: any) {
        result.errors.push(`${c.name || `kund ${i + 1}`}: ${err.message}`);
      }
    }

    // ─── Step 4: Batch INSERT new customers ───
    const insertedCustomers: { id: string; _vehicles: VehicleInfo[] }[] = [];

    for (let i = 0; i < newCustomerRows.length; i += INSERT_BATCH) {
      const chunk = newCustomerRows.slice(i, i + INSERT_BATCH);

      try {
        const insertValues = chunk.map(
          ({ _vehicles, _rowIndex, ...rest }) => rest,
        );

        const inserted = await db
          .insert(customers)
          .values(insertValues)
          .returning({ id: customers.id });

        for (let j = 0; j < inserted.length; j++) {
          insertedCustomers.push({
            id: inserted[j].id,
            _vehicles: chunk[j]._vehicles,
          });
        }

        result.created += inserted.length;
      } catch {
        // Fallback: one-by-one
        for (const row of chunk) {
          try {
            const { _vehicles, _rowIndex, ...insertVal } = row;
            const [inserted] = await db
              .insert(customers)
              .values(insertVal)
              .returning({ id: customers.id });

            insertedCustomers.push({ id: inserted.id, _vehicles });
            result.created++;
          } catch (innerErr: any) {
            const label =
              row.firstName || row.companyName || `kund ${row._rowIndex + 1}`;
            result.errors.push(`${label}: ${innerErr.message}`);
          }
        }
      }
    }

    // ─── Step 5: Batch vehicle linking ───
    // Collect all vehicle links
    const allVehicleLinks: {
      customerId: string;
      regNr: string;
      brand: string;
    }[] = [];

    for (const dup of duplicateVehicleLinks) {
      for (const v of dup.vehicles) {
        if (v.regNr) {
          allVehicleLinks.push({
            customerId: dup.customerId,
            regNr: v.regNr,
            brand: v.brand || "Okänt",
          });
        }
      }
    }

    for (const c of insertedCustomers) {
      for (const v of c._vehicles) {
        if (v.regNr) {
          allVehicleLinks.push({
            customerId: c.id,
            regNr: v.regNr,
            brand: v.brand || "Okänt",
          });
        }
      }
    }

    if (allVehicleLinks.length > 0) {
      const vehiclesToUpdate: { vehicleId: string; customerId: string }[] = [];
      const vehiclesToCreate: {
        regNr: string;
        brand: string;
        model: string;
        customerId: string;
      }[] = [];

      for (const link of allVehicleLinks) {
        const cleanReg = link.regNr.toUpperCase().replace(/[\s-]/g, "");
        if (!cleanReg || cleanReg.length < 2) continue;

        const existing = vehicleMap.get(cleanReg);
        if (existing) {
          if (!existing.customerId) {
            vehiclesToUpdate.push({
              vehicleId: existing.id,
              customerId: link.customerId,
            });
            existing.customerId = link.customerId;
          }
        } else {
          vehiclesToCreate.push({
            regNr: cleanReg,
            brand: link.brand || "Okänt",
            model: "Okänt",
            customerId: link.customerId,
          });
          vehicleMap.set(cleanReg, {
            id: "pending",
            customerId: link.customerId,
          });
        }
      }

      // Batch update existing vehicles
      if (vehiclesToUpdate.length > 0) {
        for (
          let i = 0;
          i < vehiclesToUpdate.length;
          i += INSERT_BATCH
        ) {
          const chunk = vehiclesToUpdate.slice(i, i + INSERT_BATCH);
          try {
            await Promise.all(
              chunk.map((v) =>
                db
                  .update(vehicles)
                  .set({ customerId: v.customerId })
                  .where(eq(vehicles.id, v.vehicleId)),
              ),
            );
            result.linkedVehicles += chunk.length;
          } catch {
            for (const v of chunk) {
              try {
                await db
                  .update(vehicles)
                  .set({ customerId: v.customerId })
                  .where(eq(vehicles.id, v.vehicleId));
                result.linkedVehicles++;
              } catch {
                /* skip */
              }
            }
          }
        }
      }

      // Batch insert new vehicles
      if (vehiclesToCreate.length > 0) {
        for (let i = 0; i < vehiclesToCreate.length; i += INSERT_BATCH) {
          const chunk = vehiclesToCreate.slice(i, i + INSERT_BATCH);
          try {
            await db.insert(vehicles).values(chunk);
            result.linkedVehicles += chunk.length;
          } catch {
            for (const v of chunk) {
              try {
                await db.insert(vehicles).values(v);
                result.linkedVehicles++;
              } catch {
                /* duplicate regNr, skip */
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Import misslyckades: ${err.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: result });
}
