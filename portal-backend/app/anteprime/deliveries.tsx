"use client";
import {useEffect,useState} from "react";
type Artist={id:string;name:string};
type Track={id:string;artistId:string;title:string};
type Delivery={id:string;title:string;fileName:string;enabled:boolean};
export default function Deliveries({artists,tracks}:{artists:Artist[];tracks:Track[]}){
 const [artistId,setArtistId]=useState("");
 const [trackId,setTrackId]=useState("");
 const [items,setItems]=useState<Delivery[]>([]);
 const [title,setTitle]=useState("");
 const [fileName,setFileName]=useState("");
 const [fileId,setFileId]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function load(id:string){
  if(!id){setItems([]);return;}
  const r=await fetch("/api/artist-deliveries?artistId="+encodeURIComponent(id),{cache:"no-store"});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Caricamento fallito");
  setItems(d.items);
 }
 useEffect(()=>{load(artistId).catch(e=>setError(e.message));},[artistId]);
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");
  try{
   const r=await fetch("/api/artist-deliveries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:crypto.randomUUID(),artistId,trackId,title,fileId,fileName})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Salvataggio non riuscito");
   setTitle("");setFileId("");setFileName("");await load(artistId);
  }catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 async function toggle(id:string,enabled:boolean){
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/artist-deliveries",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,enabled})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Modifica non riuscita");
   await load(artistId);
  }catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 return <section className="card">
  <h2>Consegne definitive</h2>
  <p>Ogni consegna viene registrata bloccata. Abilita il download soltanto dopo aver verificato il saldo e il file corretto.</p>
  <label>Artista<select value={artistId} onChange={e=>{setArtistId(e.target.value);setTrackId("");}}><option value="">Seleziona artista</option>{artists.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
  {artistId?<><form onSubmit={create}>
   <label>Brano<select required value={trackId} onChange={e=>setTrackId(e.target.value)}><option value="">Seleziona brano</option>{tracks.filter(t=>t.artistId===artistId).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
   <label>Descrizione<input required value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>Nome file<input required value={fileName} onChange={e=>setFileName(e.target.value)}/></label>
   <label>ID file Drive<input required value={fileId} onChange={e=>setFileId(e.target.value)}/></label>
   <button className="button" type="submit" disabled={busy}>Registra consegna bloccata</button>
  </form>
  {items.map(i=><div className="ledger-row" key={i.id}>
   <div><strong>{i.title}</strong><p className="small">{i.fileName}</p></div>
   <label><input type="checkbox" role="switch" disabled={busy} checked={i.enabled} onChange={e=>void toggle(i.id,e.target.checked)}/> {i.enabled?"Download autorizzato":"Download bloccato"}</label>
  </div>)}</>:null}
  {error?<p role="alert">{error}</p>:null}
 </section>;
}
