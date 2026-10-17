import "server-only";
import { getDb } from "./db";
import { resolveAssignee } from "./team";
import { validateOperations, emptyOperations } from "./operations-data";
import { validId } from "./task-data";
export class OperationsError extends Error {}
const resources = {
  project: { table: "studio_projects", title: "title" },
  production: { table: "studio_production", title: "data->>'title'" },
  task: { table: "studio_tasks", title: "title" },
  artist: { table: "studio_artists", title: "name" },
} as const;
export type ResourceKind = keyof typeof resources;
async function cleanupArtistRecords(c: import("pg").PoolClient, owner:string, ids:string[]){
 for(const [table,condition] of [
  ["studio_artist_preview_events","preview_id IN (SELECT id FROM studio_artist_previews WHERE owner_id=$1 AND track_id=ANY($2::uuid[]))"],
  ...["studio_artist_notifications","studio_artist_track_messages","studio_artist_deliveries","studio_artist_previews"].map(t=>[t,"track_id=ANY($2::uuid[])"])
 ]){const exists=await c.query("SELECT to_regclass($1) AS name",['public.'+table]);if(exists.rows[0]?.name)await c.query(`DELETE FROM ${table} WHERE owner_id=$1 AND ${condition}`,[owner,ids]);}
}
export async function purgeProject(owner: string, id: string, version: number, confirmation: string) {
  if (!validId(id)) throw new OperationsError("Identificativo non valido.");
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [owner]);
    const r = await c.query("SELECT title,version,deleted_at FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE", [owner,id]);
    const p = r.rows[0];
    if (!p || !p.deleted_at) throw new OperationsError("Puoi eliminare definitivamente solo un progetto nel cestino.");
    if (p.version !== version) throw new OperationsError("Progetto modificato. Aggiorna e riprova.");
    if (confirmation !== p.title) throw new OperationsError("Scrivi il titolo esatto per confermare l’eliminazione definitiva.");
    const children=await c.query("SELECT id FROM studio_production WHERE owner_id=$1 AND project_id=$2 FOR UPDATE",[owner,id]);
    await cleanupArtistRecords(c,owner,children.rows.map(r=>r.id));
    // Remove resource histories before their parents; every query is workspace scoped.
    await c.query(`DELETE FROM studio_work_history WHERE owner_id=$1 AND resource_id IN (
      SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2
      UNION SELECT id FROM studio_tasks WHERE owner_id=$1 AND project_id=$2
      UNION SELECT id FROM studio_production WHERE owner_id=$1 AND project_id=$2
      UNION SELECT id FROM studio_hours WHERE owner_id=$1 AND project_id=$2
      UNION SELECT id FROM studio_delivery WHERE owner_id=$1 AND project_id=$2
      UNION SELECT id FROM studio_costs WHERE owner_id=$1 AND project_id=$2)`,[owner,id]);
    await c.query("DELETE FROM studio_cost_history WHERE cost_id IN (SELECT id FROM studio_costs WHERE owner_id=$1 AND project_id=$2)",[owner,id]);
    await c.query("DELETE FROM studio_production_history WHERE owner_id=$1 AND item_id IN (SELECT id FROM studio_production WHERE owner_id=$1 AND project_id=$2)",[owner,id]);
    for(const table of ["studio_payments","studio_installments","studio_quote_history","studio_quotes"])
      await c.query(`DELETE FROM ${table} WHERE owner_id=$1 AND project_id IN (SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 UNION SELECT id FROM studio_production WHERE owner_id=$1 AND project_id=$2)`,[owner,id]);
    for(const table of ["studio_costs","studio_hours","studio_delivery","studio_workflow","studio_tasks","studio_production"])
      await c.query(`DELETE FROM ${table} WHERE owner_id=$1 AND project_id=$2`,[owner,id]);
    await c.query("DELETE FROM studio_projects WHERE owner_id=$1 AND id=$2",[owner,id]);
    await c.query("COMMIT");
  } catch(e) { await c.query("ROLLBACK"); throw e; }
  finally { c.release(); }
}
export async function purgeProduction(owner:string,id:string,version:number,confirmation:string){
 if(!validId(id))throw new OperationsError("Identificativo non valido.");
 const c=await getDb().connect();
 try{
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))",[owner]);
  const parent=await c.query("SELECT project_id FROM studio_production WHERE owner_id=$1 AND id=$2",[owner,id]);
  if(parent.rows[0]?.project_id)await c.query("SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE",[owner,parent.rows[0].project_id]);
  const r=await c.query("SELECT id,kind,data,version,deleted_at FROM studio_production WHERE owner_id=$1 AND id=$2 FOR UPDATE",[owner,id]);
  const item=r.rows[0];
  if(!item||!item.deleted_at)throw new OperationsError("Puoi eliminare definitivamente solo una produzione nel cestino.");
  if(item.version!==version)throw new OperationsError("Scheda modificata. Aggiorna e riprova.");
  if(confirmation!==(item.data?.title??""))throw new OperationsError("Scrivi il titolo esatto per confermare.");
  if(!["track","recording","live","service","material","revision"].includes(item.kind))throw new OperationsError("Tipo di produzione non eliminabile.");
  const related=await c.query(`WITH RECURSIVE tree AS (
   SELECT id,kind,data FROM studio_production WHERE owner_id=$1 AND id=$2
   UNION SELECT child.id,child.kind,child.data FROM studio_production child
   JOIN tree parent ON child.owner_id=$1 AND child.data->>'trackId'=parent.id::text
   WHERE child.id<>parent.id
  ) SELECT DISTINCT id,kind FROM tree`,[owner,id]);
  const ids=related.rows.map(x=>x.id);
  if(!ids.length)throw new OperationsError("Produzione non disponibile.");
  await cleanupArtistRecords(c,owner,ids);
  await c.query("DELETE FROM studio_work_history WHERE owner_id=$1 AND resource_id IN (SELECT id FROM studio_hours WHERE owner_id=$1 AND production_id=ANY($2::uuid[]))",[owner,ids]);
  await c.query("DELETE FROM studio_hours WHERE owner_id=$1 AND production_id=ANY($2::uuid[])",[owner,ids]);
  // Restrict all deletions to records of this workspace.
  const optional=async(table:string,condition:string,params:unknown[])=>{
    const exists=await c.query("SELECT to_regclass($1) AS name",["public."+table]);
    if(exists.rows[0]?.name)await c.query(`DELETE FROM ${table} WHERE owner_id=$1 AND ${condition}`,params);
  };
  await optional("studio_artist_preview_events","preview_id IN (SELECT id FROM studio_artist_previews WHERE owner_id=$1 AND track_id=ANY($2::uuid[]))",[owner,ids]);
  for(const table of ["studio_artist_notifications","studio_artist_track_messages","studio_artist_deliveries","studio_artist_previews"])
   await optional(table,"track_id=ANY($2::uuid[])",[owner,ids]);
  await optional("studio_production_history","item_id=ANY($2::uuid[])",[owner,ids]);
  await optional("studio_work_history","resource_id=ANY($2::uuid[])",[owner,ids]);
  for(const table of ["studio_payments","studio_installments","studio_quote_history","studio_quotes"])
   await optional(table,"project_id=ANY($2::uuid[])",[owner,ids]);
  await optional("studio_delivery","track_id=ANY($2::uuid[])",[owner,ids]);
  await c.query("DELETE FROM studio_production WHERE owner_id=$1 AND id=ANY($2::uuid[])",[owner,ids]);
  await c.query("COMMIT");
 }catch(e){await c.query("ROLLBACK");throw e}
 finally{c.release()}
}
export async function purgeSimpleResource(owner:string,kind:"artist"|"task",id:string,version:number,confirmation:string){
 if(!validId(id)||!["artist","task"].includes(kind))throw new OperationsError("Scheda non valida.");
 const c=await getDb().connect();try{await c.query("BEGIN");await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))",[owner]);const spec=resources[kind];
 const r=(await c.query(`SELECT version,deleted_at,${spec.title} AS title FROM ${spec.table} WHERE owner_id=$1 AND id=$2 FOR UPDATE`,[owner,id])).rows[0];
 if(!r?.deleted_at||r.version!==version||r.title!==confirmation)throw new OperationsError("Controlla titolo e versione della scheda nel cestino.");
 if(kind==='artist'){
 const links=await c.query("SELECT id FROM studio_projects WHERE owner_id=$1 AND artist_id=$2 UNION SELECT id FROM studio_production WHERE owner_id=$1 AND artist_id=$2 LIMIT 1",[owner,id]);
 if(links.rows.length)throw new OperationsError("Elimina definitivamente o riassegna prima tutti i lavori collegati all’artista, anche nel cestino.");
 for(const table of ['studio_artist_access','studio_artist_notifications','studio_artist_track_messages','studio_artist_deliveries','studio_artist_previews']){const exists=await c.query('SELECT to_regclass($1) AS name',['public.'+table]);if(exists.rows[0]?.name)await c.query(`DELETE FROM ${table} WHERE owner_id=$1 AND artist_id=$2`,[owner,id]);}
 }else await c.query("UPDATE studio_tasks SET blocked_by=blocked_by-$2,version=version+1,updated_at=now() WHERE owner_id=$1 AND blocked_by ? $2",[owner,id]);
 await c.query("DELETE FROM studio_work_history WHERE owner_id=$1 AND resource_id=$2",[owner,id]);await c.query(`DELETE FROM ${spec.table} WHERE owner_id=$1 AND id=$2`,[owner,id]);await c.query("COMMIT");
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
export async function saveOperations(
  owner: string,
  id: string,
  version: number,
  input: unknown,
  actor: string,
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "SELECT * FROM studio_projects WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",
      [owner, id],
    );
    const p = r.rows[0];
    if (!p || p.version !== version)
      throw new OperationsError(
        "Progetto modificato o non disponibile. Aggiorna e riapri.",
      );
    let d;
    try {
      d = validateOperations(input, p.kind);
    } catch {
      throw new OperationsError(
        "Controlla fase, prossimo passo e data di ricontatto.",
      );
    }
    const previous = { ...emptyOperations(), ...p.operations };
    for (const email of [d.leadEmail, ...d.collaborators].filter(Boolean))
      if (
        email !== previous.leadEmail &&
        !previous.collaborators.includes(email)
      )
        await resolveAssignee(c, owner, email);
    await c.query(
      "UPDATE studio_projects SET operations=$3,version=version+1,updated_at=now() WHERE owner_id=$1 AND id=$2",
      [owner, id, JSON.stringify(d)],
    );
    await c.query(
      "INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,'operations',$3,$4,$5)",
      [id, owner, version + 1, JSON.stringify(d), actor],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    if (e instanceof Error && e.message === "ASSIGNEE_INVALID")
      throw new OperationsError("Seleziona persone abilitate del team.");
    throw e;
  } finally {
    c.release();
  }
}
export async function listTrash(owner: string) {
  const result = [];
  for (const [kind, spec] of Object.entries(resources)) {
    const r = await getDb().query(
      `SELECT id,version,${spec.title} AS title,deleted_at AS "deletedAt" FROM ${spec.table} WHERE owner_id=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
      [owner],
    );
    result.push(...r.rows.map((p) => ({ ...p, kind })));
  }
  return result.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
  );
}
export async function trashResource(
  owner: string,
  kind: ResourceKind,
  id: string,
  version: number,
  restore: boolean,
  confirmation: string,
  actor: string,
) {
  if (!Object.hasOwn(resources, kind) || !validId(id))
    throw new OperationsError("Identificativo non valido.");
  const spec = resources[kind],
    c = await getDb().connect();
  try {
    await c.query("BEGIN");
    // A common workspace lock serializes trash/restore operations and dependency checks.
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [
      owner,
    ]);
    let r = await c.query(
      `SELECT *,${spec.title} AS label FROM ${spec.table} WHERE owner_id=$1 AND id=$2`,
      [owner, id],
    );
    let p = r.rows[0];
    if (!p) throw new OperationsError("Scheda non disponibile.");
    // Lock the project first, matching production/task writers, then the child resource.
    if (p.project_id) {
      const parent = await c.query(
        "SELECT deleted_at FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE",
        [owner, p.project_id],
      );
      if (parent.rows[0]?.deleted_at)
        throw new OperationsError("Ripristina prima il progetto collegato.");
    }
    if (kind === "production" && !p.project_id && p.artist_id) {
      const artist = await c.query("SELECT deleted_at FROM studio_artists WHERE owner_id=$1 AND id=$2 FOR UPDATE",[owner,p.artist_id]);
      if (!artist.rows[0] || artist.rows[0].deleted_at) throw new OperationsError("Ripristina prima l’artista collegato.");
    }
    r = await c.query(
      `SELECT *,${spec.title} AS label FROM ${spec.table} WHERE owner_id=$1 AND id=$2 FOR UPDATE`,
      [owner, id],
    );
    p = r.rows[0];
    if (p.version !== version || Boolean(p.deleted_at) !== restore)
      throw new OperationsError("Scheda modificata. Aggiorna e riprova.");
    if (!restore && confirmation !== p.label)
      throw new OperationsError(
        "Scrivi il titolo esatto per confermare l’eliminazione.",
      );
    if (kind === "artist" && !restore) {
      const links = await c.query(
        "SELECT id FROM studio_projects WHERE owner_id=$1 AND artist_id=$2 AND deleted_at IS NULL LIMIT 1",
        [owner, id],
      );
      if (links.rows[0])
        throw new OperationsError(
          "Elimina o riassegna prima i progetti attivi di questo artista.",
        );
    }
    if (kind === "artist" && !restore) {
      const direct = await c.query("SELECT r.id FROM studio_production r WHERE r.owner_id=$1 AND r.artist_id=$2 AND r.project_id IS NULL AND r.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM studio_production t WHERE t.owner_id=r.owner_id AND t.id::text=r.data->>'trackId' AND t.deleted_at IS NOT NULL) LIMIT 1",[owner,id]);
      if (direct.rows[0]) throw new OperationsError("Sposta prima nel cestino i brani e servizi singoli di questo artista.");
    }
    if (kind === "project" && restore && p.artist_id) {
      const a = await c.query(
        "SELECT deleted_at FROM studio_artists WHERE owner_id=$1 AND id=$2 FOR UPDATE",
        [owner, p.artist_id],
      );
      if (a.rows[0]?.deleted_at)
        throw new OperationsError("Ripristina prima l’artista collegato.");
    }
    if (kind === "production" && restore && p.kind === "track") {
      const missing = await c.query(
        "SELECT d.id FROM studio_delivery d JOIN studio_projects pr ON pr.id=d.project_id AND pr.owner_id=d.owner_id WHERE d.owner_id=$1 AND d.track_id=$2 AND d.required AND NOT d.done AND pr.status='Completato' LIMIT 1",
        [owner, id],
      );
      if (missing.rows[0])
        throw new OperationsError(
          "Riattiva prima il progetto: il brano ha verifiche obbligatorie da completare.",
        );
    }
    if (kind === "production" && restore && p.data.trackId) {
      const track = await c.query(
        "SELECT deleted_at FROM studio_production WHERE owner_id=$1 AND id=$2 AND kind='track'",
        [owner, p.data.trackId],
      );
      if (!track.rows[0] || track.rows[0].deleted_at)
        throw new OperationsError("Ripristina prima il brano collegato.");
    }
    if (kind === "task" && !restore) {
      const dependents = await c.query(
        "SELECT id FROM studio_tasks WHERE owner_id=$1 AND deleted_at IS NULL AND status<>'Completata' AND blocked_by ? $2 LIMIT 1",
        [owner, id],
      );
      if (dependents.rows[0])
        throw new OperationsError(
          "Rimuovi prima le dipendenze delle attività collegate.",
        );
    }
    await c.query(
      `UPDATE ${spec.table} SET deleted_at=${restore ? "NULL" : "now()"},version=version+1,updated_at=now() WHERE owner_id=$1 AND id=$2`,
      [owner, id],
    );
    await c.query(
      "INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        owner,
        "trash-" + kind,
        version + 1,
        JSON.stringify({
          action: restore ? "restore" : "delete",
          title: p.label,
        }),
        actor,
      ],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
