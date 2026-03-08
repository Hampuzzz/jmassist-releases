import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";

// Fake user object for dev bypass mode
const DEV_USER = {
  id: "632689da-3142-4d81-8da4-ff2b514958fb",
  email: "admin@jmassist.se",
  role: "authenticated",
  aud: "authenticated",
  app_metadata: { provider: "email", role: "admin" },
  user_metadata: { full_name: "Dev User" },
  created_at: new Date().toISOString(),
};

/**
 * Creates a dev-bypass Supabase client that returns a fake user.
 * The auth methods return the dev user; other methods proxy to the real client.
 */
function createDevBypassClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: DEV_USER }, error: null }),
      getSession: async () => ({ data: { session: { user: DEV_USER, access_token: "dev", refresh_token: "dev" } }, error: null }),
    },
  } as any;
}

export function createServerClient() {
  if (DEV_BYPASS) {
    return createDevBypassClient();
  }

  const cookieStore = cookies();

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component - safe to ignore
          }
        },
      },
    },
  );
}

export function createServiceRoleClient() {
  if (DEV_BYPASS) {
    return createDevBypassClient();
  }

  const cookieStore = cookies();

  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
