"use client";
import {useState} from "react";
export default function CreatePreview({artists,tracks}:{artists:{id:string;name:string}[];tracks:{id:string;artistId:string;title:string}[]}) {
 const [artistId,setArtistId]=useState("");
 const [trackId,setTrackId]=useState("");
 const [title,setTitle]=useState("");
 const [versionLabel,setVersionLabel]=useState("Mix v01");
 const [driveFileId,setDriveFileId]=useState("");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setMessage("");
  try {
   const r=await fetch("/api/artist-previews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:crypto.randomUUID(),artistId,trackId,title,versionLabel,driveFileId})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Salvataggio fallito");
   window.location.reload();
  }catch(e){setMessage(e instanceof Error?e.message:"Salvataggio non riuscito");}
  finally{setBusy(false);}
 }
 return <section className="card"><h2>Nuova anteprima</h2><p>Inserisci l’ID di una copia MP3 dedicata all’ascolto, mai quello di un master originale. Non viene condiviso alcun file automaticamente.</p>
 <form onSubmit={submit}>
 <label>Artista<select required value={artistId} onChange={e=>{setArtistId(e.target.value);setTrackId("");}}><option value="">Seleziona</option>{artists.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select></label>
 <label>Brano<select required value={trackId} onChange={e=>setTrackId(e.target.value)}><option value="">Seleziona</option>{tracks.filter(t=>t.artistId===artistId).map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
 <label>Titolo<input required maxLength={300} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>Versione<input required maxLength={100} value={versionLabel} onChange={e=>setVersionLabel(e.target.value)}/></label>
 <label>ID file Drive<input required maxLength={200} value={driveFileId} onChange={e=>setDriveFileId(e.target.value)}/></label>
 <button className="button" disabled={busy} type="submit">{busy?"Salvataggio…":"Registra anteprima"}</button>
 {message?<p role="alert">{message}</p>:null}
 </form></section>;
}
