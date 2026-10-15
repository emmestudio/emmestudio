"use client";
import ArtistNotifications from "../area-artista/notifications";
import TrackFinance from "./track-finance";
import {useEffect,useState} from "react";
import TrackMessages from "../area-artista/track-messages";
const previewStates=[
 {value:"draft",label:"Bozza · Non visibile",description:"Solo lo studio può vedere questa versione."},
 {value:"ready",label:"Disponibile per l’ascolto",description:"L’artista può ascoltare questa versione."},
 {value:"approved",label:"Approvata dall’artista",description:"Versione approvata; l’ascolto resta disponibile."},
 {value:"revision_requested",label:"Revisione richiesta",description:"L’artista ha richiesto modifiche; l’ascolto resta disponibile."},
 {value:"withdrawn",label:"Ritirata · Non visibile",description:"Questa versione non è più ascoltabile dall’artista."}
] as const;
export default function TrackSharing({trackId,artistId}:{trackId:string;artistId:string}){
 const [history,setHistory]=useState<{id:string;eventType:string;occurredAt:string;notes:string;title:string;versionLabel:string}[]>([]);
 const [previews,setPreviews]=useState<{id:string;title:string;status:string;versionLabel:string;feedback:string}[]>([]);
 const [deliveries,setDeliveries]=useState<{id:string;title:string;enabled:boolean;fileName:string;trackId:string}[]>([]);
 const [title,setTitle]=useState(""),[version,setVersion]=useState("Mix v01"),[previewFile,setPreviewFile]=useState("");
 const [deliveryName,setDeliveryName]=useState(""),[deliveryFile,setDeliveryFile]=useState(""),[deliveryTitle,setDeliveryTitle]=useState("");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function removeMaterial(kind:"preview"|"delivery",id:string,name:string){
  if(!window.confirm("Spostare nel cestino di Google Drive e rimuovere dal portale il file «"+name+"»? L’operazione impedirà immediatamente l’accesso dell’artista."))return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/artist-material-delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,id,artistId,trackId})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Eliminazione non riuscita");
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Eliminazione non riuscita");}
  finally{setBusy(false);}
 }

 async function load(){
  const [a,b]=await Promise.all([fetch("/api/artist-previews?artist="+artistId,{cache:"no-store"}),fetch("/api/artist-deliveries?artistId="+artistId,{cache:"no-store"})]);
  const x=await a.json(),y=await b.json();
  if(!a.ok||!b.ok)throw Error(x.error||y.error||"Materiali non disponibili");
  setPreviews(x.items.filter((i:{trackId:string})=>i.trackId===trackId));
  setDeliveries(y.items.filter((i:{trackId:string})=>i.trackId===trackId));
  const h=await fetch("/api/artist-version-history?artistId="+encodeURIComponent(artistId)+"&trackId="+encodeURIComponent(trackId),{cache:"no-store"});
  if(h.ok){const data=await h.json();setHistory(data.items??[]);}
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[trackId,artistId]);
 async function request(url:string,method:string,data:unknown){
  setBusy(true);setError("");
  try{
   const r=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Operazione fallita");await load();return true;
  }catch(e){setError(e instanceof Error?e.message:"Operazione non riuscita");return false;}finally{setBusy(false);}
 }
 const [uploadKind,setUploadKind]=useState<"preview"|"delivery">("preview");
 const [uploadFile,setUploadFile]=useState<File|null>(null);
 const [progress,setProgress]=useState<number|null>(null);
 async function upload(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!uploadFile)return;
  setBusy(true);setError("");setProgress(0);
  try{
   const file=uploadFile;
   const start=await fetch("/api/artist-large-upload?action=start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({artistId,trackId,kind:uploadKind,name:file.name,total:file.size})});
   const d=await start.json();if(!start.ok)throw Error(d.error||"Avvio caricamento fallito");
   let done=false;
   for(let offset=0;offset<file.size;offset+=d.chunkSize){
    const end=Math.min(offset+d.chunkSize,file.size);
    const r=await fetch("/api/artist-large-upload?action=chunk",{method:"POST",headers:{"Content-Type":"application/octet-stream","X-Upload-Ticket":d.ticket,"X-Upload-Offset":String(offset)},body:file.slice(offset,end)});
    const result=await r.json();if(!r.ok)throw Error(result.error||"Invio interrotto");
    done=Boolean(result.complete);
    setProgress(Math.round(end/file.size*100));
   }
   if(!done)throw Error("Google Drive non ha confermato la conclusione del caricamento");
   setUploadFile(null);setProgress(null);await load();
  }catch(e){setError(e instanceof Error?e.message:"Caricamento fallito");}finally{setBusy(false);}
 }
 return <div className="track-panel">
  <h3>Area Artista · Condivisioni</h3>
  <ArtistNotifications/>
  <p>Le anteprime sono copie MP3. I file definitivi rimangono bloccati finché non li autorizzi.</p>
  <form onSubmit={upload}>
   <h4>Carica direttamente su Google Drive</h4>
   <p>Il file viene salvato nell’archivio privato dell’artista e associato a questo brano. La condivisione parte sempre disattivata. Supporta file fino a 1 GB; le anteprime MP3 devono essere inferiori a 20 MB.</p>
   <label>Tipo materiale<select value={uploadKind} disabled={busy} onChange={e=>{setUploadKind(e.target.value as "preview"|"delivery");setUploadFile(null);}}><option value="preview">Anteprima MP3</option><option value="delivery">Consegna definitiva</option></select></label>
   <label>Seleziona file<input key={uploadKind} id="track-file-upload" type="file" required accept={uploadKind==="preview"?".mp3,audio/mpeg":".mp3,.wav,.zip,.pdf"} disabled={busy} onChange={e=>setUploadFile(e.target.files?.[0]??null)}/></label>
   <button className="button" disabled={busy||!uploadFile||uploadFile.size>1024*1024*1024||(uploadKind==="preview"&&uploadFile.size>20*1024*1024)} type="submit">{busy?"Caricamento…":"Carica e associa automaticamente"}</button>
   {progress!==null?<div role="status" aria-live="polite">Caricamento: {progress}%<progress max={100} value={progress} style={{width:"100%"}}/></div>:null}
   {uploadFile&&(uploadFile.size>1024*1024*1024||(uploadKind==="preview"&&uploadFile.size>20*1024*1024))?<p role="alert">File troppo grande per questa tipologia.</p>:null}
  </form>
  <h4>Anteprime per ascolto</h4>
  {previews.map(p=><div key={p.id} className="artist-permission-row">
   <div className="artist-permission-details"><strong>{p.title} · {p.versionLabel}</strong><span className="artist-permission-file">{previewStates.find(x=>x.value===p.status)?.description??p.status}</span>{p.feedback?<span className="artist-permission-file">Feedback: {p.feedback}</span>:null}</div>
   <div className="artist-preview-status-control"><label htmlFor={"preview-status-"+p.id}>Visibilità e stato dell’anteprima</label><select id={"preview-status-"+p.id} aria-label={"Stato anteprima "+p.title} value={p.status} disabled={busy} onChange={e=>void request("/api/artist-previews","PATCH",{id:p.id,status:e.target.value})}>
    {previewStates.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
   </select><button type="button" className="secondary" disabled={busy} onClick={()=>void removeMaterial("preview",p.id,p.title)}>Elimina anteprima</button></div>
  </div>)}
  <section className="artist-history"><h4>Cronologia delle versioni</h4><p className="small">Pubblicazioni, approvazioni, revisioni e ritiri registrati da oggi. Le operazioni precedenti all’attivazione dello storico non vengono ricostruite.</p>
   {history.length? <ol className="artist-history-list">{history.map(e=><li key={e.id}><div><strong>{e.versionLabel} · {({published:"Pubblicata per l’ascolto",approved:"Approvata",revision_requested:"Revisione richiesta",withdrawn:"Ritirata"} as Record<string,string>)[e.eventType]??e.eventType}</strong><span>{new Date(e.occurredAt).toLocaleString("it-IT")}</span></div><p>{e.title}</p>{e.notes&&e.eventType==="revision_requested"?<p className="small">Nota: {e.notes}</p>:null}</li>)}</ol>:<p className="small">Nessun evento ancora registrato per questo brano.</p>}
  </section>
  <TrackMessages trackId={trackId} artistId={artistId}/>
  <TrackFinance trackId={trackId}/>
  <h4>Consegne definitive</h4>
  {deliveries.map(d=><div key={d.id} className="artist-permission-row">
   <div className="artist-permission-details"><strong>{d.title}</strong><span className="artist-permission-file">{d.fileName}</span></div>
   <div className="artist-permission-control">
    <span className={"artist-permission-state "+(d.enabled?"is-active":"is-inactive")}>{d.enabled?"Download attivo":"Download non consentito"}</span>
    <label className="artist-permission-switch"><input type="checkbox" role="switch" aria-label={"Abilita download per "+d.title} checked={d.enabled} disabled={busy} onChange={e=>void request("/api/artist-deliveries","PATCH",{id:d.id,enabled:e.target.checked})}/><span className="artist-permission-slider" aria-hidden="true"/><span className="artist-permission-label">Abilita download</span></label>
   </div>
  </div>)}
  {error?<p role="alert">{error}</p>:null}
 </div>;
}