import "server-only";
import type { PoolClient } from "pg";
import { getDb } from "./db";
import { getAuth } from "./auth";
import { googleDrive, type DriveClient } from "./google-drive";
import { artistFolders, liveFolders, driveScope, DriveError, type DriveSubject } from "./drive-data";

export async function drivePermission(owner: string) {
  const r = await getDb().query('SELECT id,scope FROM account WHERE "userId"=$1 AND "providerId"=\'google\'', [owner]);
  const account = r.rows[0];
  return { account, granted: Boolean(account && (account.scope ?? "").split(/[ ,]+/).includes(driveScope)) };
}
async function clientForOwner(owner: string) {
  const { account, granted } = await drivePermission(owner);
  if (!granted) throw new DriveError(403, "L’amministratore deve autorizzare Google Drive dall’Archivio Drive.");
  const token = await getAuth().api.getAccessToken({ body: { accountId: account.id, userId: owner } });
  return googleDrive(token.accessToken);
}
async function locked<T>(owner: string, work: (c: PoolClient) => Promise<T>) {
  const c = await getDb().connect();
  let acquired = false;
  try {
    const lock = await c.query("SELECT pg_try_advisory_lock(hashtextextended($1,187346214)) AS acquired", [owner]);
    acquired = Boolean(lock.rows[0]?.acquired);
    if (!acquired) throw new DriveError(409, "Archivio in aggiornamento. Attendi qualche secondo e riprova.");
    return await work(c);
  } finally {
    let destroy=false;
    try { if (acquired) await c.query("SELECT pg_advisory_unlock(hashtextextended($1,187346214))", [owner]); }
    catch { destroy=true; }
    finally { c.release(destroy); }
  }
}
// IDs are committed before Google writes. A timeout or process crash can always retry the SAME ID.
export async function ensureDriveFolder(c: Pick<PoolClient,"query">, api: DriveClient, owner: string, key: string, name: string, parent: string | null) {
  let row = (await c.query("SELECT * FROM studio_drive_folders WHERE owner_id=$1 AND subject_key=$2", [owner,key])).rows[0];
  if (!row) {
    const id = await api.generateId();
    await c.query("INSERT INTO studio_drive_folders(owner_id,subject_key,folder_id,name,parent_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,subject_key) DO NOTHING", [owner,key,id,name,parent]);
    row = (await c.query("SELECT * FROM studio_drive_folders WHERE owner_id=$1 AND subject_key=$2", [owner,key])).rows[0];
  }
  try {
    let remote = await api.get(row.folder_id);
    if (!remote) {
      // A previously confirmed folder must be restored by the owner, never silently replaced.
      if (row.state === "ready") throw new DriveError(409, "Cartella eliminata o non accessibile. Ripristinala da Drive e riprova.");
      await api.create(row.folder_id, name, parent);
      remote = await api.get(row.folder_id);
      if (!remote) throw new DriveError(502, "Cartella creata: verifica Drive e riprova per completare il collegamento.");
    }
    if (remote.trashed || remote.mimeType !== "application/vnd.google-apps.folder") throw new DriveError(409, "La cartella è nel cestino di Drive. Ripristinala prima di sincronizzare.");
    if (remote.name !== name || (parent && !remote.parents?.includes(parent))) await api.update(row.folder_id, name, parent, remote.parents ?? []);
    await c.query("UPDATE studio_drive_folders SET state='ready',error='',name=$3,parent_id=$4,updated_at=now() WHERE owner_id=$1 AND subject_key=$2", [owner,key,name,parent]);
    return row.folder_id as string;
  } catch (e) {
    // Retain the 'ready' state on failures so a deleted confirmed folder can never be recreated.
    await c.query("UPDATE studio_drive_folders SET error=$3,updated_at=now() WHERE owner_id=$1 AND subject_key=$2", [owner,key, e instanceof DriveError ? e.message : "Sincronizzazione da riprovare."]);
    throw e;
  }
}
export async function configureDrive(owner: string) {
  const api = await clientForOwner(owner);
  return locked(owner, async c => {
    const root = await ensureDriveFolder(c,api,owner,"root","Emme Studio — Archivio",null);
    await ensureDriveFolder(c,api,owner,"artists","Artisti",root);
  });
}
export async function driveSubject(owner: string, kind: DriveSubject, id: string) {
  if (kind === "artist") {
    const r = await getDb().query("SELECT id,name FROM studio_artists WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL", [owner,id]);
    if (!r.rows[0]) throw new DriveError(404, "Artista non disponibile.");
    return { name: r.rows[0].name as string, artistId: id };
  }
  const r = await getDb().query(`SELECT p.data->>'title' AS name,COALESCE(j.artist_id,p.artist_id) AS artist_id FROM studio_production p LEFT JOIN studio_projects j ON j.owner_id=p.owner_id AND j.id=p.project_id JOIN studio_artists a ON a.owner_id=p.owner_id AND a.id=COALESCE(j.artist_id,p.artist_id) AND a.deleted_at IS NULL WHERE p.owner_id=$1 AND p.id=$2 AND p.kind='live' AND p.deleted_at IS NULL AND (j.id IS NULL OR j.deleted_at IS NULL)`, [owner,id]);
  if (!r.rows[0]) throw new DriveError(404, "Produzione live non disponibile o artista da assegnare.");
  return { name: r.rows[0].name as string, artistId: r.rows[0].artist_id as string };
}
export async function syncDriveSubject(owner: string, kind: DriveSubject, id: string) {
  const subject = await driveSubject(owner,kind,id);
  const root = (await getDb().query("SELECT folder_id,state FROM studio_drive_folders WHERE owner_id=$1 AND subject_key='root'", [owner])).rows[0];
  if (!root) throw new DriveError(409, "Attiva prima l’Archivio Drive dal menu del portale.");
  const api = await clientForOwner(owner);
  return locked(owner, async c => {
    // Re-read after acquiring the workspace lock to use the latest saved name/context.
    const current = await driveSubject(owner,kind,id);
    const artist = await driveSubject(owner,"artist",current.artistId);
    const rootId = await ensureDriveFolder(c,api,owner,"root","Emme Studio — Archivio",null);
    const artists = await ensureDriveFolder(c,api,owner,"artists","Artisti",rootId);
    const artistKey = `artist/${current.artistId}`;
    const artistId = await ensureDriveFolder(c,api,owner,artistKey,artist.name,artists);
    const parents: Record<string,string> = {};
    for (const [key,name] of artistFolders) parents[key] = await ensureDriveFolder(c,api,owner,`${artistKey}/${key}`,name,artistId);
    if (kind === "live") {
      const key = `live/${id}`;
      const liveId = await ensureDriveFolder(c,api,owner,key,current.name,parents.live);
      for (const [child,name] of liveFolders) await ensureDriveFolder(c,api,owner,`${key}/${child}`,name,liveId);
    }
    return subject;
  });
}
export async function autoSyncDrive(owner: string, kind: DriveSubject, id: string) {
  try { await syncDriveSubject(owner,kind,id); return { ready: true }; }
  catch (e) { return { ready: false, message: e instanceof DriveError ? e.message : "Lavoro salvato. Collegamento Drive da completare dalla scheda." }; }
}
export async function listDriveFolders(owner: string, prefix?: string) {
  const r = await getDb().query('SELECT subject_key AS key,folder_id AS id,name,state,error FROM studio_drive_folders WHERE owner_id=$1 AND ($2::text IS NULL OR subject_key=$2 OR starts_with(subject_key,$2||\'/\')) ORDER BY subject_key', [owner,prefix ?? null]);
  return r.rows;
}

/** Creates or recovers per-song folders. Database keys use immutable UUIDs, never song titles. */
export async function syncTrackDriveFolders(owner:string,trackId:string){
 const r=await getDb().query(`SELECT p.data->>'title' AS title,COALESCE(j.artist_id,p.artist_id) AS artist_id
 FROM studio_production p LEFT JOIN studio_projects j ON j.owner_id=p.owner_id AND j.id=p.project_id
 JOIN studio_artists a ON a.owner_id=p.owner_id AND a.id=COALESCE(j.artist_id,p.artist_id) AND a.deleted_at IS NULL
 WHERE p.owner_id=$1 AND p.id=$2 AND p.kind='track' AND p.deleted_at IS NULL
 AND (p.project_id IS NULL OR j.deleted_at IS NULL)`,[owner,trackId]);
 const song=r.rows[0];if(!song?.artist_id)throw new DriveError(404,"Brano o artista non disponibile");
 await syncDriveSubject(owner,"artist",song.artist_id);
 const api=await clientForOwner(owner);
 return locked(owner,async c=>{
  const key=`artist/${song.artist_id}`;
  const parent=(await c.query("SELECT folder_id FROM studio_drive_folders WHERE owner_id=$1 AND subject_key=$2 AND state='ready'",[owner,key+"/music"])).rows[0]?.folder_id;
  if(!parent)throw new DriveError(409,"Cartella Produzione musicale non disponibile");
  const base=`track/${trackId}`;
  const songFolder=await ensureDriveFolder(c,api,owner,base,String(song.title||"Brano senza titolo").slice(0,180),parent);
  const previews=await ensureDriveFolder(c,api,owner,base+"/previews","Versioni anteprima",songFolder);
  const deliveries=await ensureDriveFolder(c,api,owner,base+"/deliveries","Consegne definitive",songFolder);
  return {previews,deliveries};
 });
}
