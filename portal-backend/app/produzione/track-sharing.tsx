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
 const [uploadKind,setUploadKind]=useState<"preview"|"delivery">("preview");
 const [uploadFile,setUploadFile]=useState<File|null>(null);
 async function upload(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!uploadFile)return;
  setBusy(true);setError("");
  try{
   const form=new FormData();form.set("artistId",artistId);form.set("trackId",trackId);form.set("kind",uploadKind);form.set("file",uploadFile);
   const r=await fetch("/api/artist-upload",{method:"POST",body:form});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Caricamento non riuscito");
   setUploadFile(null);const input=document.getElementById("track-file-upload") as HTMLInputElement|null;if(input)input.value="";
   await load();
  }catch(e){setError(e instanceof Error?e.message:"Caricamento fallito");}finally{setBusy(false);}
 }
 return <div className="track-panel">
  <h3>Area Artista · Condivisioni</h3>
  <p>Le anteprime sono copie MP3. I file definitivi rimangono bloccati finché non li autorizzi.</p>
  <form onSubmit={upload}>
   <h4>Carica direttamente su Google Drive</h4>
   <p>Il file viene salvato nell’archivio privato dell’artista e associato a questo brano. La condivisione parte sempre disattivata. Limite attuale: 4 MB.</p>
   <label>Tipo materiale<select value={uploadKind} disabled={busy} onChange={e=>{setUploadKind(e.target.value as "preview"|"delivery");setUploadFile(null);}}><option value="preview">Anteprima MP3</option><option value="delivery">Consegna definitiva</option></select></label>
   <label>Seleziona file<input key={uploadKind} id="track-file-upload" type="file" required accept={uploadKind==="preview"?".mp3,audio/mpeg":".mp3,.wav,.zip,.pdf"} disabled={busy} onChange={e=>setUploadFile(e.target.files?.[0]??null)}/></label>
   <button className="button" disabled={busy||!uploadFile||uploadFile.size>4*1024*1024} type="submit">{busy?"Caricamento…":"Carica e associa automaticamente"}</button>
   {uploadFile&&uploadFile.size>4*1024*1024?<p role="alert">Il file supera 4 MB: usa temporaneamente l’ID Drive o prepara una copia MP3 più piccola.</p>:null}
  </form>
  <h4>Anteprime per ascolto</h4>
  {previews.map(p=><div key={p.id} className="ledger-row"><div><strong>{p.title} · {p.versionLabel}</strong><p>{p.status}</p>{p.feedback?<p>Feedback: {p.feedback}</p>:null}</div><select aria-label={"Stato "+p.title} value={p.status} disabled={busy} onChange={e=>void request("/api/artist-previews","PATCH",{id:p.id,status:e.target.value})}>
   {["draft","ready","approved","revision_requested","withdrawn"].map(x=><option key={x} value={x}>{x}</option>)}
  </select></div>)}
  <h4>Consegne definitive</h4>
  {deliveries.map(d=><div key={d.id} className="ledger-row"><div><strong>{d.title}</strong><p>{d.fileName}</p></div><label><input role="switch" type="checkbox" checked={d.enabled} disabled={busy} onChange={e=>void request("/api/artist-deliveries","PATCH",{id:d.id,enabled:e.target.checked})}/> {d.enabled?"Download abilitato":"Download bloccato"}</label></div>)}
  {error?<p role="alert">{error}</p>:null}
 </div>;
}