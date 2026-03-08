import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Public API routes that don't require Supabase session (use API key instead)
const PUBLIC_API_ROUTES = ["/api/availability", "/api/book"];

// Dev bypass: skip auth when Supabase is not running
const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight for public API routes
  if (
    request.method === "OPTIONS" &&
    PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    const origin = request.headers.get("origin") ?? "";
    const isDev = process.env.NODE_ENV === "development";
    const allowOrigin = isDev || allowedOrigins.includes(origin) ? origin || "*" : "";

    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin":  allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        "Access-Control-Max-Age":       "86400",
      },
    });
  }

  // Skip auth for public API routes (handled by API key middleware)
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip auth for portal API (uses own JWT auth)
  if (pathname.startsWith("/api/portal/")) {
    return NextResponse.next();
  }

  // Skip auth for auth callback, iCal, and public approval endpoints
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/kalender/ical") ||
    pathname.startsWith("/api/approval/") ||
    pathname.startsWith("/godkann/")
  ) {
    return NextResponse.next();
  }

  // DEV BYPASS: Skip all auth checks, allow all pages
  if (DEV_BYPASS) {
    // Redirect /login to /dashboard in dev bypass mode
    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Skip auth for login page
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // For all other routes: validate Supabase session
  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
              response.cookies.set(name, value, options as any),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Redirect unauthenticated users to login
    if (!user && !pathname.startsWith("/login")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(url);
    }

    // Redirect authenticated users away from login
    if (user && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  } catch (err) {
    // If Supabase is unreachable, allow access in dev mode
    if (process.env.NODE_ENV === "development") {
      console.warn("[middleware] Supabase unreachable, allowing access in dev mode");
      return NextResponse.next();
    }
    // In production, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
