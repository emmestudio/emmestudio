import {configurationReady} from '@/lib/config';
import {getAuth} from '@/lib/auth';
import { workspaceSession } from '@/lib/workspace-session';
import { canEdit, canManageAccess } from '@/lib/access-policy';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const session = await workspaceSession(request.headers);
  return session ? Response.json({ role: session.role, canEdit: canEdit(session.role), canManageAccess: canManageAccess(session.role), authenticated:true }, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ authenticated:Boolean(configurationReady() && (await getAuth().api.getSession({headers:request.headers}))?.user) }, { headers: {'Cache-Control':'no-store'} });
}
