import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  parts, stockMovements, workOrderParts,
  purchaseOrders, purchaseOrderLines,
} from "@/lib/db/schemas";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/inkop/registrera
 *
 * Register a purchase from a supplier. Creates/updates parts in inventory,
 * records stock movements, optionally links to a work order, and saves
 * a purchase order log for audit.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { supplierId, workOrderId, reference, notes, lines } = body;

  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "Minst en artikelrad krävs" }, { status: 400 });
  }

  // Validate lines
  for (const line of lines) {
    if (!line.partNumber?.trim() || !line.partName?.trim()) {
      return NextResponse.json({ error: "Artikelnummer och namn krävs för alla rader" }, { status: 400 });
    }
    if (!line.quantity || line.quantity <= 0) {
      return NextResponse.json({ error: "Antal måste vara > 0" }, { status: 400 });
    }
    if (line.unitCostPrice == null || line.unitCostPrice < 0) {
      return NextResponse.json({ error: "Inköpspris krävs" }, { status: 400 });
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const resolvedLines: Array<{
        partId: string;
        partNumber: string;
        partName: string;
        quantity: number;
        unitCostPrice: number;
      }> = [];

      for (const line of lines) {
        const partNumber = line.partNumber.trim();
        const partName = line.partName.trim();
        const quantity = parseFloat(line.quantity);
        const unitCostPrice = parseFloat(line.unitCostPrice);
        const sellPrice = line.sellPrice ? parseFloat(line.sellPrice) : null;

        // 1. Find or create part
        let [existing] = await tx
          .select({ id: parts.id, stockQty: parts.stockQty, costPrice: parts.costPrice })
          .from(parts)
          .where(eq(parts.partNumber, partNumber))
          .limit(1);

        let partId: string;

        if (existing) {
          // Update cost price and supplier if changed
          const updates: Record<string, unknown> = {
            updatedAt: new Date(),
          };
          if (unitCostPrice !== parseFloat(existing.costPrice)) {
            updates.costPrice = unitCostPrice.toString();
          }
          if (supplierId) {
            updates.supplierId = supplierId;
          }
          if (sellPrice != null) {
            updates.sellPrice = sellPrice.toString();
          }

          await tx
            .update(parts)
            .set(updates)
            .where(eq(parts.id, existing.id));

          partId = existing.id;
        } else {
          // Create new part
          const [newPart] = await tx
            .insert(parts)
            .values({
              partNumber,
              name: partName,
              costPrice: unitCostPrice.toString(),
              sellPrice: sellPrice?.toString() ?? "0",
              stockQty: "0",
              supplierId: supplierId || null,
              category: "general",
            })
            .returning({ id: parts.id, stockQty: parts.stockQty });

          partId = newPart.id;
          existing = { id: newPart.id, stockQty: newPart.stockQty, costPrice: unitCostPrice.toString() };
        }

        // 2. Increment stock
        const qtyBefore = parseFloat(existing.stockQty);
        const qtyAfter = qtyBefore + quantity;

        await tx
          .update(parts)
          .set({ stockQty: qtyAfter.toString(), updatedAt: new Date() })
          .where(eq(parts.id, partId));

        // 3. Record stock movement (supplier_delivery)
        await tx.insert(stockMovements).values({
          partId,
          workOrderId: workOrderId || null,
          userId: user.id,
          reason: "supplier_delivery",
          qtyChange: quantity.toString(),
          qtyBefore: qtyBefore.toString(),
          qtyAfter: qtyAfter.toString(),
          unitCost: unitCostPrice.toString(),
          notes: reference ? `Inköp ref: ${reference}` : null,
        });

        // 4. If work order specified, add to work order parts
        // The DB trigger trg_stock_on_part_use will automatically:
        //   - decrement stockQty
        //   - insert a stock_movement with reason 'work_order_use'
        if (workOrderId) {
          await tx.insert(workOrderParts).values({
            workOrderId,
            partId,
            quantity: quantity.toString(),
            unitCostPrice: unitCostPrice.toString(),
            unitSellPrice: (sellPrice ?? unitCostPrice * 1.3).toString(),
            vmbEligible: false,
            addedBy: user.id,
            notes: `Inköp från leverantör${reference ? ` (ref: ${reference})` : ""}`,
          });
        }

        resolvedLines.push({ partId, partNumber, partName, quantity, unitCostPrice });
      }

      // 5. Create purchase order record
      const [po] = await tx.insert(purchaseOrders).values({
        supplierId: supplierId || null,
        workOrderId: workOrderId || null,
        status: "delivered",
        reference: reference?.trim() || null,
        notes: notes?.trim() || null,
        orderedAt: new Date(),
        deliveredAt: new Date(),
        createdBy: user.id,
      }).returning();

      // 6. Create purchase order lines
      for (const line of resolvedLines) {
        await tx.insert(purchaseOrderLines).values({
          purchaseOrderId: po.id,
          partId: line.partId,
          partNumberRaw: line.partNumber,
          partNameRaw: line.partName,
          quantity: line.quantity.toString(),
          unitCostPrice: line.unitCostPrice.toString(),
        });
      }

      return { purchaseOrder: po, lineCount: resolvedLines.length };
    });

    return NextResponse.json({
      data: result.purchaseOrder,
      lineCount: result.lineCount,
      message: `${result.lineCount} artikel(ar) registrerade`,
    }, { status: 201 });
  } catch (err: any) {
    console.error("[inkop/registrera] Error:", err);
    return NextResponse.json({ error: err.message ?? "Något gick fel" }, { status: 500 });
  }
}
