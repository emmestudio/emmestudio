const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "PORTAL_OWNER_EMAIL"] as const;

export function configurationReady(env: Record<string, string | undefined> = process.env): boolean {
  if (required.some(key => !env[key]?.trim())) return false;
  if ((env.BETTER_AUTH_SECRET?.length ?? 0) < 32) return false;
  try {
    const url = new URL(env.BETTER_AUTH_URL!);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && env.NODE_ENV !== "production" && url.protocol === "http:")) return false;
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.PORTAL_OWNER_EMAIL!);
  } catch { return false; }
}

export function ownerAllowed(email: string, verified: boolean, owner = process.env.PORTAL_OWNER_EMAIL): boolean {
  return Boolean(verified && owner && email.trim().toLowerCase() === owner.trim().toLowerCase());
}
