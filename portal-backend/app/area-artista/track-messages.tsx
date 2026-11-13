"use client";
import {useEffect,useState} from "react";
type Message={id:string;senderRole:"studio"|"artist";body:string;createdAt:string};
export default function TrackMessages({artistId,trackId,workTitle}:{artistId?:string;trackId:string;workTitle?:string}){
 const [items,setItems]=useState<Message[]>([]),[body,setBody]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [files,setFiles]=useState<{id:string;messageId:string;filename:string}[]>([]);
 const query=new URLSearchParams({trackId,...(artistId?{artistId}:{})}).toString();
 async function load(){
  const r=await fetch("/api/artist-track-messages?"+query,{cache:"no-store"});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Conversazione non disponibile");setItems(d.items);setFiles(d.files??[]);
 }
 useEffect(()=>{load().catch(e=>setError(e.message));},[query]);
 async function send(e:React.FormEvent){
  e.preventDefault();if(!body.trim())return;
  setBusy(true);setError("");
  try{const r=await fetch("/api/artist-track-messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trackId,artistId,body:body.trim()})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Messaggio non inviato");setBody("");await load();
  }catch(e){setError(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 return <section className="artist-conversation"><h4>{workTitle??"Conversazione sul brano"}</h4><p className="small">Messaggi riservati all’artista e allo studio.</p>
  <div className="artist-conversation-thread">{items.length?items.map(m=><div key={m.id} className={"artist-conversation-message "+(m.senderRole==="studio"?"from-studio":"from-artist")}><strong>{m.senderRole==="studio"?"Emme Studio":"Artista"}</strong><p>{m.body}</p>{files.filter(f=>f.messageId===m.id).map(f=><a key={f.id} href={"/api/artist-conversations/attachments/"+f.id} target="_blank" rel="noopener noreferrer">{f.filename} ↗</a>)}<time>{new Date(m.createdAt).toLocaleString("it-IT")}</time></div>):<p className="small">Ancora nessun messaggio.</p>}</div>
  <form onSubmit={send}><label>Nuovo messaggio<textarea maxLength={3000} rows={3} value={body} onChange={e=>setBody(e.target.value)} placeholder="Scrivi un messaggio relativo a questo lavoro…"/></label><button className="button" type="submit" disabled={busy||!body.trim()}>{busy?"Invio…":"Invia messaggio"}</button></form>
  {error?<p role="alert">{error}</p>:null}
 </section>;
}
