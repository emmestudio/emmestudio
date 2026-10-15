import 'server-only';
import type {PoolClient} from 'pg';
import {getDb} from './db';
import {FinanceInputError} from './finance-data';
import {productionSpecs} from './production-data';
export type FinanceTarget={contactName?:string;id:string;title:string;artist:string;artistId:string|null;service:string;deletedAt:string|null;subjectKind:'project'|'production';parentProjectId?:string|null;productionKind?:string};
export async function lockFinanceTarget(c:PoolClient,owner:string,id:string,kind:'project'|'production',active=false){
 if(kind==='project'){
  const r=await c.query('SELECT id,deleted_at FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE',[owner,id]);
  if(!r.rows[0] || (active && r.rows[0].deleted_at))throw new FinanceInputError('Progetto non disponibile.');
  await c.query('INSERT INTO studio_finance_targets(id,owner_id,project_id) VALUES($1,$2,$1) ON CONFLICT DO NOTHING',[id,owner]);
 }else{
  const before=await c.query('SELECT project_id FROM studio_production WHERE owner_id=$1 AND id=$2',[owner,id]);
  if(before.rows[0]?.project_id)await c.query('SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE',[owner,before.rows[0].project_id]);
  const r=await c.query("SELECT r.id,r.kind,r.deleted_at,p.deleted_at AS parent_deleted,a.deleted_at AS artist_deleted,t.deleted_at AS track_deleted FROM studio_production r LEFT JOIN studio_projects p ON p.id=r.project_id AND p.owner_id=r.owner_id LEFT JOIN studio_artists a ON a.id=COALESCE(p.artist_id,r.artist_id) AND a.owner_id=r.owner_id LEFT JOIN studio_production t ON t.id::text=r.data->>'trackId' AND t.owner_id=r.owner_id WHERE r.owner_id=$1 AND r.id=$2 FOR UPDATE OF r",[owner,id]);
  const item=r.rows[0];
  if(!item||!['track','recording','live','service'].includes(item.kind)||(active&&(item.deleted_at||item.parent_deleted||item.artist_deleted||item.track_deleted)))throw new FinanceInputError('Lavoro non disponibile.');
  await c.query('INSERT INTO studio_finance_targets(id,owner_id,production_id) VALUES($1,$2,$1) ON CONFLICT DO NOTHING',[id,owner]);
 }
 const target=await c.query('SELECT project_id,production_id FROM studio_finance_targets WHERE owner_id=$1 AND id=$2',[owner,id]);
 if(!target.rows[0] || !target.rows[0][kind==='project'?'project_id':'production_id'])throw new FinanceInputError('Riferimento economico non valido.');
}
export async function listFinanceTargets(owner:string):Promise<FinanceTarget[]>{
 const [projects,production]=await Promise.all([
  getDb().query(`SELECT p.id,p.title,p.artist,p.artist_id AS "artistId",p.service,p.deleted_at AS "deletedAt",concat_ws(' ',NULLIF(a.first_name,''),NULLIF(a.last_name,'')) AS "contactName" FROM studio_projects p LEFT JOIN studio_artists a ON a.id=p.artist_id AND a.owner_id=p.owner_id WHERE p.owner_id=$1`,[owner]),
  getDb().query(`SELECT concat_ws(' ',NULLIF(a.first_name,''),NULLIF(a.last_name,'')) AS "contactName",r.id,r.kind,r.data,r.project_id AS "parentProjectId",COALESCE(p.artist_id,r.artist_id) AS "artistId",COALESCE(a.name,p.artist,'Artista') AS artist,COALESCE(r.deleted_at,p.deleted_at,a.deleted_at,t.deleted_at) AS "deletedAt" FROM studio_production r LEFT JOIN studio_projects p ON p.id=r.project_id AND p.owner_id=r.owner_id LEFT JOIN studio_artists a ON a.id=COALESCE(p.artist_id,r.artist_id) AND a.owner_id=r.owner_id LEFT JOIN studio_production t ON t.id::text=r.data->>'trackId' AND t.owner_id=r.owner_id WHERE r.owner_id=$1 AND r.kind IN ('track','recording','live','service')`,[owner])]);
 return [...projects.rows.map(p=>({...p,subjectKind:'project' as const})),...production.rows.map(r=>({contactName:r.contactName,id:r.id,parentProjectId:r.parentProjectId,artistId:r.artistId,artist:r.artist,deletedAt:r.deletedAt,title:r.data.title,service:r.kind==='service'?(r.data.details?.service==='Altro'?r.data.details?.serviceOther:r.data.details?.service)||'Servizio':productionSpecs[r.kind as keyof typeof productionSpecs].singular,subjectKind:'production' as const,productionKind:r.kind}))];
}
