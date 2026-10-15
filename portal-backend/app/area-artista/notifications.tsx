"use client";
import {useEffect,useState} from "react";
type Notice={id:string;eventType:string;body:string;trackTitle:string;createdAt:string;readAt:string|null};
export default function ArtistNotifications(){
 const [items,setItems]=useState<Notice[]>([]),[open,setOpen]=useState(false),[error,setError]=useState("");
 async function load(){const r=await fetch("/api/artist-notifications",{cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Notifiche non disponibili");setItems(data.items);}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function read(id:string){
  const r=await fetch("/api/artist-notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
  if(r.ok)await load();else setError("Impossibile segnare la notifica come letta");
 }
 const unread=items.filter(x=>!x.readAt).length;
 return <section className="artist-notifications"><button type="button" className="artist-notifications-toggle" aria-expanded={open} onClick={()=>{setOpen(!open);void load().catch(e=>setError(e.message));}}>Notifiche {unread>0?<span className="artist-notifications-count">{unread}</span>:null}</button>
 {open?<div className="artist-notifications-list"><h3>Aggiornamenti sui brani</h3>{items.length?items.map(x=><div key={x.id} className={"artist-notification "+(!x.readAt?"unread":"")}><div><strong>{x.trackTitle||"Produzione musicale"}</strong><small>{new Date(x.createdAt).toLocaleString("it-IT")}</small></div><p>{x.body}</p>{!x.readAt?<button type="button" onClick={()=>void read(x.id)}>Segna come letto</button>:<span className="small">Letta</span>}</div>):<p>Non ci sono nuove notifiche.</p>}{error?<p role="alert">{error}</p>:null}</div>:null}
 </section>;
}
