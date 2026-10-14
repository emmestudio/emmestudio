import { getDb } from "@/lib/db";
import { createBackup, cronAuthorized } from "@/lib/backups";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(r: Request) {
  if (!cronAuthorized(r.headers.get("authorization"), process.env.CRON_SECRET))
    return Response.json({ error: "Non autorizzato." }, { status: 401 });
  if (
    process.env.VERCEL_PROJECT_ID !== "prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK" ||
    process.env.VERCEL_ENV !== "production"
  )
    return Response.json(
      { error: "Ambiente non consentito." },
      { status: 403 },
    );
  try {
    const owner = await getDb().query(
      'SELECT id FROM "user" WHERE lower(email)=lower($1) AND "emailVerified"=true',
      [process.env.PORTAL_OWNER_EMAIL],
    );
    if (!owner.rows[0]) throw new Error("OWNER_NOT_FOUND");
    return Response.json(await createBackup(owner.rows[0].id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Backup non completato." }, { status: 503 });
  }
}
