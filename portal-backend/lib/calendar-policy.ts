export const calendarScope = 'https://www.googleapis.com/auth/calendar.app.created';
export function calendarAuthorized(scopes: string[]) { return scopes.includes(calendarScope); }
export function sameOrigin(origin: string | null, base: string | undefined) {
  if (!origin || !base) return false;
  try { return new URL(origin).origin === new URL(base).origin; } catch { return false; }
}
