import { workspaceSession } from "@/lib/workspace-session";
import { sameOrigin } from "@/lib/calendar-policy";
import { createBackup, listBackups, downloadBackup } from "@/lib/backups";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(r: Request) {
  try {
    const s = await workspaceSession(r.headers);
    if (!s)
      return Response.json({ error: "Accesso richiesto." }, { status: 401 });
    if (s.role !== "admin")
      return Response.json(
        { error: "Riservato all’amministratore." },
        { status: 403 },
      );
    const path = new URL(r.url).searchParams.get("download");
    if (path) {
      const b = await downloadBackup(s.workspaceOwnerId, path);
      if (!b || b.statusCode !== 200)
        return new Response(null, { status: 404 });
      return new Response(b.stream, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="emme-studio-backup.json"',
          "Cache-Control": "no-store",
        },
      });
    }
    return Response.json(await listBackups(s.workspaceOwnerId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Backup non disponibili." }, { status: 503 });
  }
}
export async function POST(r: Request) {
  if (!sameOrigin(r.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return Response.json(
      { error: "Richiesta non autorizzata." },
      { status: 403 },
    );
  try {
    const s = await workspaceSession(r.headers);
    if (!s)
      return Response.json({ error: "Accesso richiesto." }, { status: 401 });
    if (s.role !== "admin")
      return Response.json(
        { error: "Riservato all’amministratore." },
        { status: 403 },
      );
    if(process.env.STUDIO_BACKUPS_ENABLED!=="true")return Response.json({error:"Trasferimento backup in attesa di autorizzazione."},{status:403});
    return Response.json(await createBackup(s.workspaceOwnerId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Backup non completato o controllo di rilettura fallito." },
      { status: 503 },
    );
  }
}
