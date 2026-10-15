import Feedback from "./feedback";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {artistSession} from "@/lib/artist-session";
import {getDb} from "@/lib/db";
export const dynamic="force-dynamic";
export default async function ArtistPage(){
 const session=await artistSession(await headers());
 if(!session)redirect("/accesso?area=artista");
 const r=await getDb().query(
  `SELECT x.id,x.title,x.version_label AS "versionLabel",x.status,p.data->>'title' AS "trackTitle"
   FROM studio_artist_previews x
   JOIN studio_production p ON p.owner_id=x.owner_id AND p.id=x.track_id AND p.deleted_at IS NULL
   WHERE x.owner_id=$1 AND x.artist_id=$2 AND x.status IN ('ready','approved','revision_requested')
   ORDER BY x.updated_at DESC LIMIT 100`,[session.ownerId,session.artistId]);
 return <main className="shell dashboard">
  <span className="eyebrow">EMME STUDIO · AREA ARTISTA</span>
  <h1>Benvenuto, <em>{session.artistName}.</em></h1>
  <p>Questo spazio contiene esclusivamente le anteprime approvate per la consultazione del tuo progetto.</p>
  <section className="card"><h2>Le tue produzioni</h2>
   {r.rows.length? r.rows.map((x:{id:string;title:string;versionLabel:string;status:string;trackTitle:string})=>
    <div className="ledger-row" key={x.id}><div><strong>{x.trackTitle}</strong><p className="small">{x.title} · {x.versionLabel}</p></div><div><audio controls preload="none" controlsList="nodownload noremoteplayback" src={"/api/artist-audio/"+x.id} aria-label={"Ascolta "+x.title}/><Feedback id={x.id} status={x.status}/><span>{x.status==="approved"?"Approvata":"In ascolto"}</span></div></div>
   ):<p>Nessuna anteprima disponibile al momento.</p>}
  </section>
  <p className="small">Le anteprime sono riservate all’ascolto. Le revisioni e le consegne saranno abilitate separatamente.</p>
 </main>;
}
