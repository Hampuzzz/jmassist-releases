import { NextRequest, NextResponse } from "next/server";

/**
 * Returns CORS headers for a given request origin.
 * Only allows origins listed in ALLOWED_ORIGINS env var.
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const requestOrigin = request.headers.get("origin") ?? "";

  // Allow all in development
  const isDev = process.env.NODE_ENV === "development";

  const allowOrigin =
    isDev || allowedOrigins.includes(requestOrigin)
      ? requestOrigin || "*"
      : "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/**
 * Handles OPTIONS preflight requests.
 */
export function handleCorsOptions(request: NextRequest): NextResponse {
  const headers = getCorsHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}

/**
 * Adds CORS headers to any existing response.
 */
export function withCors(response: NextResponse, request: NextRequest): NextResponse {
  const headers = getCorsHeaders(request);
  Object.entries(headers).forEach(([key, value]) => {
    if (value) response.headers.set(key, value);
  });
  return response;
}
