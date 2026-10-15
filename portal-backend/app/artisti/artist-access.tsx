"use client";
import {useEffect,useState} from "react";
export default function ArtistAccess({artistId}:{artistId:string}){
 const [email,setEmail]=useState("");
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 useEffect(()=>{
  const c=new AbortController();
  fetch("/api/artist-access?artistId="+encodeURIComponent(artistId),{signal:c.signal,cache:"no-store"})
   .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;})
   .then(d=>{setEmail(d.access.email??"");setEnabled(Boolean(d.access.enabled));setMessage("");})
   .catch(e=>{if(!c.signal.aborted)setMessage(e instanceof Error?e.message:"Accesso non disponibile");});
  return ()=>c.abort();
 },[artistId]);
 async function save(next:boolean){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/artist-access",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({artistId,email,enabled:next})});
   const d=await r.json();if(!r.ok)throw Error(d.error);
   setEnabled(next);setMessage(next?"Area Artista abilitata.":"Accesso disabilitato.");
  }catch(e){setMessage(e instanceof Error?e.message:"Modifica non riuscita");}
  finally{setBusy(false);}
 }
 return <section className="card">
  <h3>Accesso Area Artista</h3>
  <p className="small">Account Google verificato. L'artista accede solo ai propri materiali pubblicati, mai al gestionale del team.</p>
  <label>Email autorizzata<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="artista@example.com" maxLength={254}/></label>
  <div className="dialog-actions">
   <label><input type="checkbox" role="switch" checked={enabled} disabled={busy} onChange={e=>void save(e.target.checked)}/> Accesso {enabled?"abilitato":"disabilitato"}</label>
   <button className="secondary" disabled={busy||!email.trim()} onClick={()=>void save(enabled)}>Salva email</button>
  </div>
  {message?<p role="status">{message}</p>:null}
 </section>;
}