import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const MIME_TYPES: Record<string, string> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
  mp4:  "video/mp4",
  mov:  "video/quicktime",
  webm: "video/webm",
  avi:  "video/x-msvideo",
  m4v:  "video/mp4",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * GET /api/media/serve/[...path]
 * Serves uploaded files from local disk (data/uploads/).
 * No auth required — URLs are unguessable (UUID filenames).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const segments = params.path;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "Sökväg saknas" }, { status: 400 });
  }

  // Security: prevent path traversal
  const joined = segments.join("/");
  if (joined.includes("..") || joined.includes("~")) {
    return NextResponse.json({ error: "Ogiltig sökväg" }, { status: 400 });
  }

  const fullPath = path.join(UPLOAD_DIR, ...segments);

  // Make sure resolved path is within UPLOAD_DIR
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Inte en fil" }, { status: 404 });
    }

    const buffer = await readFile(resolved);
    const ext = path.extname(resolved).slice(1).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Filen hittades inte" }, { status: 404 });
  }
}
