import { workspaceSession } from '@/lib/workspace-session';
import { canEdit, canManageAccess } from '@/lib/access-policy';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const session = await workspaceSession(request.headers);
  return session ? Response.json({ role: session.role, canEdit: canEdit(session.role), canManageAccess: canManageAccess(session.role), isOwner: session.user.id === session.workspaceOwnerId }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Accesso richiesto.' }, { status: 401 });
}
