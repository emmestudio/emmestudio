"use client";
import {useEffect,useState} from "react";
export default function TrackSharing({trackId,artistId}:{trackId:string;artistId:string}){
 const [previews,setPreviews]=useState<{id:string;title:string;status:string;versionLabel:string;feedback:string}[]>([]);
 const [deliveries,setDeliveries]=useState<{id:string;title:string;enabled:boolean;fileName:string;trackId:string}[]>([]);
 const [title,setTitle]=useState(""),[version,setVersion]=useState("Mix v01"),[previewFile,setPreviewFile]=useState("");
 const [deliveryName,setDeliveryName]=useState(""),[deliveryFile,setDeliveryFile]=useState(""),[deliveryTitle,setDeliveryTitle]=useState("");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function load(){
  const [a,b]=await Promise.all([fetch("/api/artist-previews?artist="+artistId,{cache:"no-store"}),fetch("/api/artist-deliveries?artistId="+artistId,{cache:"no-store"})]);
  const x=await a.json(),y=await b.json();
  if(!a.ok||!b.ok)throw Error(x.error||y.error||"Materiali non disponibili");
  setPreviews(x.items.filter((i:{trackId:string})=>i.trackId===trackId));
  setDeliveries(y.items.filter((i:{trackId:string})=>i.trackId===trackId));
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[trackId,artistId]);
 async function request(url:string,method:string,data:unknown){
  setBusy(true);setError("");
  try{
   const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Operazione fallita");await load();return true;
  }catch(e){setError(e instanceof Error?e.message:"Operazione non riuscita");return false;}finally{setBusy(false);}
 }
 return <div className="track-panel">
  <h3>Area Artista · Condivisioni</h3>
  <p>Le anteprime sono copie MP3. I file definitivi rimangono bloccati finché non li autorizzi.</p>
  <h4>Anteprime per ascolto</h4>
  {previews.map(p=><div key={p.id} className="ledger-row"><div><strong>{p.title} · {p.versionLabel}</strong><p>{p.status}</p>{p.feedback?<p>Feedback: {p.feedback}</p>:null}</div><select aria-label={"Stato "+p.title} value={p.status} disabled={busy} onChange={e=>void request("/api/artist-previews","PATCH",{id:p.id,status:e.target.value})}>
   {["draft","ready","approved","revision_requested","withdrawn"].map(x=><option key={x} value={x}>{x}</option>)}
  </select></div>)}
  <form onSubmit={e=>{e.preventDefault();void request("/api/artist-previews","POST",{id:crypto.randomUUID(),artistId,trackId,title,versionLabel:version,driveFileId:previewFile}).then(ok=>{if(ok){setTitle("");setPreviewFile("");}});}}>
   <label>Titolo anteprima<input required value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>Versione<input required value={version} onChange={e=>setVersion(e.target.value)}/></label>
   <label>ID Drive copia MP3<input required value={previewFile} onChange={e=>setPreviewFile(e.target.value)}/></label>
   <button disabled={busy} className="button" type="submit">Registra anteprima</button>
  </form>
  <h4>Consegne definitive</h4>
  {deliveries.map(d=><div key={d.id} className="ledger-row"><div><strong>{d.title}</strong><p>{d.fileName}</p></div><label><input role="switch" type="checkbox" checked={d.enabled} disabled={busy} onChange={e=>void request("/api/artist-deliveries","PATCH",{id:d.id,enabled:e.target.checked})}/> {d.enabled?"Download abilitato":"Download bloccato"}</label></div>)}
  <form onSubmit={e=>{e.preventDefault();void request("/api/artist-deliveries","POST",{id:crypto.randomUUID(),artistId,trackId,title:deliveryTitle,fileName:deliveryName,fileId:deliveryFile}).then(ok=>{if(ok){setDeliveryTitle("");setDeliveryName("");setDeliveryFile("");}});}}>
   <label>Descrizione consegna<input required value={deliveryTitle} onChange={e=>setDeliveryTitle(e.target.value)}/></label>
   <label>Nome file<input required value={deliveryName} onChange={e=>setDeliveryName(e.target.value)}/></label>
   <label>ID Drive file definitivo<input required value={deliveryFile} onChange={e=>setDeliveryFile(e.target.value)}/></label>
   <button disabled={busy} className="button" type="submit">Registra consegna bloccata</button>
  </form>
  {error?<p role="alert">{error}</p>:null}
 </div>;
}