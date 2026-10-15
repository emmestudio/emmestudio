import Deliveries from "./deliveries";
import CreatePreview from "./create-preview";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Page() {
 const session=await workspaceSession(await headers());
 if(!session)redirect("/accesso");
 if(session.role!=="admin")redirect("/dashboard");
 let items: {id:string;title:string;version_label:string;status:string;feedback:string;artist_name:string;track_name:string}[]=[];
 let unavailable=false;
 let artists: {id:string;name:string}[]=[];
 let tracks: {id:string;artistId:string;title:string}[]=[];
 try {
  const result=await getDb().query(`SELECT x.id,x.title,x.version_label,x.status,x.feedback,
     a.name AS artist_name, p.data->>'title' AS track_name
     FROM studio_artist_previews x
     JOIN studio_artists a ON a.owner_id=x.owner_id AND a.id=x.artist_id
     JOIN studio_production p ON p.owner_id=x.owner_id AND p.id=x.track_id
     WHERE x.owner_id=$1 ORDER BY x.updated_at DESC LIMIT 100`,[session.workspaceOwnerId]);
  items=result.rows;
  const [a,t]=await Promise.all([
    getDb().query("SELECT id,name FROM studio_artists WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY name",[session.workspaceOwnerId]),
    getDb().query("SELECT p.id,COALESCE(j.artist_id,p.artist_id) AS \"artistId\",p.data->>'title' AS title FROM studio_production p LEFT JOIN studio_projects j ON j.owner_id=p.owner_id AND j.id=p.project_id WHERE p.owner_id=$1 AND p.kind='track' AND p.deleted_at IS NULL AND (p.project_id IS NULL OR j.deleted_at IS NULL) ORDER BY title",[session.workspaceOwnerId])
  ]);
  artists=a.rows;tracks=t.rows;
 }catch {unavailable=true;}
 return <main className="shell dashboard">
  <span className="eyebrow">EMME STUDIO · ANTEPRIME</span>
  <h1>Anteprime <em>artisti.</em></h1>
  <p>Registro amministrativo delle versioni di ascolto. I master originali restano privati.</p>
  {unavailable?<section className="card"><h2>Registro da attivare</h2><p>Applicare prima la migrazione 013 al database. Nessun file o permesso è stato modificato.</p></section>:
  <section className="card"><h2>Versioni registrate</h2>
  {!items.length?<p>Nessuna anteprima presente.</p>:items.map(i=>
    <div className="ledger-row" key={i.id}>
     <div><strong>{i.title}</strong><p className="small">{i.artist_name} · {i.track_name} · {i.version_label}</p></div>
     <div><span>{i.status}</span>{i.feedback?<p>{i.feedback}</p>:null}</div>
    </div>)}
  </section>}
  {!unavailable?<><CreatePreview artists={artists} tracks={tracks}/><Deliveries artists={artists} tracks={tracks}/></>:null}
  <p className="small">L’ascolto degli artisti verrà attivato soltanto dopo la verifica dell’autenticazione separata e dei permessi.</p>
 </main>;
}