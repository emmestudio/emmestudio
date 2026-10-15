"use client";
import {useEffect,useState} from "react";
type Preview={id:string;title:string;versionLabel:string;status:string;feedback:string;trackId:string};
type Delivery={id:string;title:string;fileName:string;enabled:boolean;trackId:string};
export default function SharedMaterials({artistId}:{artistId:string}){
 const [previews,setPreviews]=useState<Preview[]>([]);
 const [deliveries,setDeliveries]=useState<Delivery[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  Promise.all([
   fetch("/api/artist-previews?artist="+artistId,{signal:controller.signal,cache:"no-store"}),
   fetch("/api/artist-deliveries?artistId="+artistId,{signal:controller.signal,cache:"no-store"})
  ]).then(async([a,b])=>{
   const p=await a.json(),d=await b.json();
   if(!a.ok||!b.ok)throw Error(p.error||d.error||"Materiali non disponibili");
   setPreviews(p.items);setDeliveries(d.items);setError("");
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Errore");});
  return()=>controller.abort();
 },[artistId]);
 return <section className="card">
  <h3>Materiali condivisi</h3>
  <p className="small">Riepilogo anteprime e consegne. Per modificare o autorizzare file apri la scheda del rispettivo brano.</p>
  <h4>Anteprime</h4>
  {previews.length?previews.map(p=><div className="ledger-row" key={p.id}>
   <div><strong>{p.title} · {p.versionLabel}</strong><p className="small">Stato: {p.status}</p>{p.feedback?<p className="small">{p.feedback}</p>:null}</div>
   <a href={"/produzione?track="+p.trackId}>Apri brano ↗</a>
  </div>):<p className="small">Nessuna anteprima registrata.</p>}
  <h4>Consegne definitive</h4>
  {deliveries.length?deliveries.map(d=><div className="ledger-row" key={d.id}>
   <div><strong>{d.title}</strong><p className="small">{d.fileName} · {d.enabled?"Download abilitato":"Download bloccato"}</p></div>
   <a href={"/produzione?track="+d.trackId}>Apri brano ↗</a>
  </div>):<p className="small">Nessuna consegna registrata.</p>}
  {error?<p role="alert">{error}</p>:null}
 </section>;
}
