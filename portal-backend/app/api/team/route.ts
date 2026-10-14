import { workspaceSession } from "@/lib/workspace-session";
import { listTeam } from "@/lib/team";
export const dynamic = "force-dynamic";
export async function GET(r: Request) {
  try {
    const s = await workspaceSession(r.headers);
    if (!s)
      return Response.json({ error: "Accesso richiesto." }, { status: 401 });
    return Response.json(
      {
        people: await listTeam(s.workspaceOwnerId),
        selfEmail: s.user.email.toLowerCase(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Team non disponibile." }, { status: 503 });
  }
}
