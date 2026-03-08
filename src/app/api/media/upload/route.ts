import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schemas";
import { randomUUID } from "crypto";

const BUCKET = "workshop-media";
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * POST /api/media/upload
 * Upload image/video to Supabase Storage.
 * Multipart form: file, workOrderId?, vhcItemId?
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const workOrderId = formData.get("workOrderId") as string | null;
  const vhcItemId = formData.get("vhcItemId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Ingen fil bifogad" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Filen är för stor (max 50MB)" }, { status: 400 });
  }

  // Generate unique path
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${randomUUID()}.${ext}`;
  const folder = workOrderId ? `wo/${workOrderId}` : "general";
  const filePath = `${folder}/${fileName}`;

  // Upload to Supabase Storage using service role
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[media] Upload error:", uploadError.message);
    return NextResponse.json({ error: `Upload-fel: ${uploadError.message}` }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  // Save to database
  const [record] = await db.insert(media).values({
    workOrderId: workOrderId || null,
    vhcItemId: vhcItemId || null,
    uploadedBy: user.id,
    filePath,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  }).returning();

  return NextResponse.json({
    id: record.id,
    url: urlData.publicUrl,
    filePath,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });
}
