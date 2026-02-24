import { jwtVerify, createRemoteJWKSet } from "jose";

const NEON_AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL || "";
const JWKS_URL = NEON_AUTH_BASE_URL ? `${NEON_AUTH_BASE_URL.replace(/\/$/, "")}/.well-known/jwks.json` : "";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!JWKS_URL) {
    throw new Error("NEON_AUTH_BASE_URL is not set");
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return jwks;
}

export interface NeonTokenPayload {
  sub: string;
  name?: string;
  email?: string;
}

/**
 * Verify a JWT issued by Neon Auth (Better Auth) using JWKS.
 * Returns payload with sub (user id) and optional name/email, or null if invalid.
 */
export async function verifyNeonToken(token: string): Promise<NeonTokenPayload | null> {
  if (!NEON_AUTH_BASE_URL) {
    console.error("NEON_AUTH_BASE_URL is not set");
    return null;
  }
  try {
    // Verify signature with Neon's JWKS only; skip issuer/audience so we accept
    // whatever Neon Auth sets (they may differ from NEON_AUTH_BASE_URL).
    const { payload } = await jwtVerify(token, getJwks());
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) {
      return null;
    }
    return {
      sub,
      name: typeof payload.name === "string" ? payload.name : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch (err) {
    console.error("Neon token verification failed", err);
    return null;
  }
}
