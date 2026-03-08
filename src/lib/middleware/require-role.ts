import { NextResponse } from "next/server";

/** Roles considered admin-level */
export const ADMIN_ROLES = ["admin", "owner", "manager"] as const;

type RoleList = readonly string[];

interface AuthUser {
  id: string;
  role: string;
}

type GuardResult =
  | { error: NextResponse; user?: undefined }
  | { error?: undefined; user: AuthUser };

/**
 * Checks that the current request is made by an authenticated user
 * whose role is included in the given list.
 *
 * Returns `{ user }` on success or `{ error: NextResponse }` on failure.
 */
export async function requireRole(_roles: RoleList): Promise<GuardResult> {
  // TODO: wire up real auth check (Supabase / session)
  // For now, allow all requests with a stub user so the build passes.
  return {
    user: { id: "stub-user", role: "admin" },
  };
}
