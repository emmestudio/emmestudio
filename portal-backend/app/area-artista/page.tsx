import ArtistNotifications from "./notifications";
import Feedback from "./feedback";
import TrackMessages from "./track-messages";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {artistSession} from "@/lib/artist-session";
import {getDb} from "@/lib/db";
export const dynamic="force-dynamic";
export default async function ArtistPage(){
 const session=await artistSession(await headers());
 if(!session)redirect("/accesso?area=artista");
 const r=await getDb().query(
  `SELECT x.id,x.title,x.version_label AS "versionLabel",x.status,x.track_id AS "trackId",p.data->>'title' AS "trackTitle"
   FROM studio_artist_previews x
   JOIN studio_production p ON p.owner_id=x.owner_id AND p.id=x.track_id AND p.deleted_at IS NULL
   LEFT JOIN studio_projects j ON j.id=p.project_id AND j.owner_id=p.owner_id
   WHERE x.owner_id=$1 AND x.artist_id=$2 AND x.status IN ('ready','approved','revision_requested')
   AND COALESCE(j.artist_id,p.artist_id)=x.artist_id AND (p.project_id IS NULL OR j.deleted_at IS NULL)
   ORDER BY x.updated_at DESC LIMIT 100`,[session.ownerId,session.artistId]);
 const deliveries=await getDb().query(`SELECT d.id,d.title,d.file_name AS "fileName" FROM studio_artist_deliveries d
 JOIN studio_production p ON p.id=d.track_id AND p.owner_id=d.owner_id AND p.deleted_at IS NULL
 LEFT JOIN studio_projects j ON j.id=p.project_id AND j.owner_id=p.owner_id
 WHERE d.owner_id=$1 AND d.artist_id=$2 AND d.enabled=true AND COALESCE(j.artist_id,p.artist_id)=d.artist_id AND (p.project_id IS NULL OR j.deleted_at IS NULL)
 ORDER BY d.updated_at DESC LIMIT 100`,[session.ownerId,session.artistId]);
 type ArtistPreview={id:string;title:string;versionLabel:string;status:string;trackTitle:string;trackId:string};
 const groups=new Map<string,ArtistPreview[]>();
 for(const p of r.rows as ArtistPreview[]){const key=p.trackTitle||"Brano senza titolo";const list=groups.get(key)??[];list.push(p);groups.set(key,list);}
 return <main className="shell dashboard">
  <span className="eyebrow">EMME STUDIO · AREA ARTISTA</span>
  <h1>Benvenuto, <em>{session.artistName}.</em></h1>
  <ArtistNotifications/>
  <p>Qui trovi le anteprime che lo studio ha reso disponibili per l’ascolto, le richieste di revisione e le consegne autorizzate.</p>
  <section className="card"><h2>Le tue produzioni</h2>
   {groups.size?Array.from(groups.entries()).map(([track,versions])=>
    <div className="artist-track-group" key={track}>
     <div className="artist-track-heading"><h3>{track}</h3><span>{versions.length} {versions.length===1?"versione":"versioni"}</span></div>
     <TrackMessages trackId={versions[0].trackId}/>
     {versions.map(x=><div className="artist-version-row" key={x.id}>
      <div className="artist-version-heading"><div><strong>{x.title}</strong><p className="small">{x.versionLabel}</p></div><span className={"artist-permission-state "+(x.status==="approved"?"is-active":"is-inactive")}>{x.status==="approved"?"Versione approvata":x.status==="revision_requested"?"Revisione richiesta":"Disponibile per l’ascolto"}</span></div>
      <audio controls preload="none" controlsList="nodownload noremoteplayback" src={"/api/artist-audio/"+x.id} aria-label={"Ascolta "+x.title}/>
      <Feedback id={x.id} status={x.status}/>
     </div>)}
    </div>
   ):<p>Nessuna anteprima disponibile al momento.</p>}
  </section>
  <section className="card"><h2>Consegne disponibili</h2>{deliveries.rows.length?deliveries.rows.map((d:{id:string;title:string;fileName:string})=><div className="ledger-row" key={d.id}><div><strong>{d.title}</strong><p>{d.fileName}</p></div><a className="button" href={"/api/artist-delivery-file/"+d.id}>Scarica</a></div>):<p>Nessun file definitivo disponibile.</p>}</section>
  <p className="small">Le anteprime sono dedicate all’ascolto. I download definitivi sono disponibili solo dopo autorizzazione dello studio.</p>
 </main>;
}
