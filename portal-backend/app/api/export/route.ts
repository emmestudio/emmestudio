import { workspaceSession } from "@/lib/workspace-session";
import { exportWorkspace } from "@/lib/workspace-export";
export const dynamic = "force-dynamic";
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
    return new Response(
      JSON.stringify(await exportWorkspace(s.workspaceOwnerId), null, 2),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="emme-studio-export.json"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Esportazione non disponibile." },
      { status: 503 },
    );
  }
}
