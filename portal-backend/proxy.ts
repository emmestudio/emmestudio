import { NextRequest, NextResponse } from "next/server";
const studioOrigins = new Set([
  "https://portal.emmestudioproduction.it",
  "https://emme-studio-portale.vercel.app",
]);
// Use the origin already configured for Google OAuth. Do not duplicate sessions across domains.
export function proxy(request: NextRequest) {
  if(request.nextUrl.pathname.startsWith("/api/public/news")||request.nextUrl.pathname.startsWith("/news/"))return NextResponse.next();
  const base = process.env.BETTER_AUTH_URL;
  if (!base) return NextResponse.next();
  try {
    const canonical = new URL(base).origin,
      current = request.nextUrl.origin;
    if (
      studioOrigins.has(canonical) &&
      studioOrigins.has(current) &&
      current !== canonical
    ) {
      const target = new URL(canonical);
      target.pathname = request.nextUrl.pathname;
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 307);
    }
  } catch {}
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-white.png).*)"],
};
