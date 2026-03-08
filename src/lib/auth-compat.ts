interface AuthUser {
  id: string;
  role?: string;
}

/**
 * Returns the currently authenticated user, or null if unauthenticated.
 *
 * TODO: wire up to real auth provider (Supabase / session cookies).
 * Stub returns null so the build compiles; callers already guard against null.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  return null;
}
