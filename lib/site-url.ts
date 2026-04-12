/**
 * Public origin for this deployment (no trailing slash).
 * Used for Supabase emailRedirectTo so confirmation links match your hosted app.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL — set in Vercel to your canonical URL (e.g. https://engilog.vercel.app or custom domain).
 * 2. NEXT_PUBLIC_VERCEL_URL — set in next.config from VERCEL_URL on Vercel builds.
 * 3. window.location.origin — in the browser when env is unset (local dev).
 * 4. VERCEL_URL — server-only fallback on Vercel.
 * 5. http://localhost:3000 — local Node without Vercel.
 */
function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export function getSiteOrigin(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    const u = stripTrailingSlash(site);
    return u.startsWith("http") ? u : `https://${u}`;
  }

  const vercelPublic = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercelPublic) {
    const host = stripTrailingSlash(vercelPublic).replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = stripTrailingSlash(vercel).replace(/^https?:\/\//, "");
    return `https://${host}`;
  }

  return "http://localhost:3000";
}

export function getAuthCallbackUrl(): string {
  return `${getSiteOrigin()}/auth/callback`;
}
