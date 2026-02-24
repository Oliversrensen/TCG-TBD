import { createAuthClient } from "@neondatabase/neon-js/auth";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;

export const authClient = authUrl ? createAuthClient(authUrl) : null;

/**
 * Get a JWT from Neon Auth (Better Auth token endpoint).
 * Call with credentials so the session cookie is sent.
 * Returns the token string or null.
 */
export async function getNeonAuthToken(): Promise<string | null> {
  if (!authUrl) return null;
  const base = authUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/auth/token`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data?.token ?? null;
  } catch {
    return null;
  }
}
