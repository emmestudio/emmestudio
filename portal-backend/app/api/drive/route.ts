import { workspaceSession } from "@/lib/workspace-session";
import { canEdit } from "@/lib/access-policy";
import { sameOrigin } from "@/lib/calendar-policy";
import { validId } from "@/lib/task-data";
import { DriveError, type DriveSubject } from "@/lib/drive-data";
import { configureDrive, drivePermission, driveSubject, listDriveFolders, syncDriveSubject } from "@/lib/drive-archive";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
function target(kind: unknown, id: unknown): {kind: DriveSubject; id: string} {
  if ((kind !== "artist" && kind !== "live") || !validId(id)) throw new DriveError(400,"Scheda non valida.");
  return {kind,id:id as string};
}
function failure(e: unknown) { return reply({error: e instanceof DriveError ? e.message : "Archivio Drive non disponibile. Riprova tra poco."},e instanceof DriveError ? e.status : 503); }
export async function GET(r: Request) {
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({error:"Accesso richiesto."},401);
    const q = new URL(r.url).searchParams;
    let prefix: string | undefined;
    if(q.has("kind") || q.has("id")) {
      const t=target(q.get("kind"),q.get("id"));
      await driveSubject(s.workspaceOwnerId,t.kind,t.id);
      prefix=`${t.kind}/${t.id}`;
    }
    if(!prefix && s.role !== "admin") return reply({error:"Impostazioni riservate all’amministratore."},403);
    const [permission, folders] = await Promise.all([drivePermission(s.workspaceOwnerId),listDriveFolders(s.workspaceOwnerId,prefix)]);
    return reply({permission:permission.granted,folders,canManage:s.role === "admin",canEdit:canEdit(s.role)});
  } catch(e) {return failure(e);}
}
export async function POST(r: Request) {
  if(!sameOrigin(r.headers.get("origin"),process.env.BETTER_AUTH_URL)) return reply({error:"Richiesta non autorizzata."},403);
  try {
    const s=await workspaceSession(r.headers);
    if(!s) return reply({error:"Accesso richiesto."},401);
    if(!canEdit(s.role))return reply({error:"Solo consultazione."},403);
    const b=await r.json();
    if(b.action === "configure") {
      if(s.role !== "admin" || s.user.id !== s.workspaceOwnerId) return reply({error:"Collegamento riservato al titolare."},403);
      await configureDrive(s.workspaceOwnerId);
    } else if(b.action === "sync") {
      const t=target(b.kind,b.id);
      await syncDriveSubject(s.workspaceOwnerId,t.kind,t.id);
    } else throw new DriveError(400,"Operazione non valida.");
    return reply({saved:true});
  }catch(e){return failure(e);}
}
