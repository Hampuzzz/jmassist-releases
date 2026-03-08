import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-compat";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schemas";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/**
 * POST /api/media/mobile-upload
 * Simple local-disk upload for mobile app (no Supabase Storage dependency).
 * Multipart form: file, workOrderId?, vhcItemId?
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const workOrderId = formData.get("workOrderId") as string | null;
  const vhcItemId = formData.get("vhcItemId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Ingen fil bifogad" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Filen är för stor (max 50 MB)" },
      { status: 400 },
    );
  }

  // Generate unique filename
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileId = randomUUID();
  const fileName = `${fileId}.${ext}`;

  // Organise into sub-folders by work order
  const folder = workOrderId ? path.join("wo", workOrderId) : "general";
  const fullDir = path.join(UPLOAD_DIR, folder);
  const fullPath = path.join(fullDir, fileName);

  try {
    await mkdir(fullDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);
  } catch (err: any) {
    console.error("[mobile-upload] Write error:", err);
    return NextResponse.json(
      { error: "Kunde inte spara filen" },
      { status: 500 },
    );
  }

  // Relative path used for serving
  const relativePath = path.join(folder, fileName).replace(/\\/g, "/");

  // Build public URL for serving via our serve endpoint
  const origin =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const publicUrl = `${proto}://${origin}/api/media/serve/${relativePath}`;

  // Save metadata to DB
  try {
    const [record] = await db
      .insert(media)
      .values({
        workOrderId: workOrderId || null,
        vhcItemId: vhcItemId || null,
        uploadedBy: user.id,
        filePath: relativePath,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        thumbnailPath: null,
      })
      .returning();

    return NextResponse.json({
      id: record.id,
      url: publicUrl,
      filePath: relativePath,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  } catch (err: any) {
    console.error("[mobile-upload] DB error:", err);
    // File saved — still return url even if DB insert fails
    return NextResponse.json({
      id: fileId,
      url: publicUrl,
      filePath: relativePath,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  }
}
