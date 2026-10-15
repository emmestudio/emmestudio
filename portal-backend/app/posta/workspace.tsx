"use client";
import {useState} from "react";
type Draft={id:string;accountId:string|null;recipient:string;subject:string;body:string;updatedAt:string};
type Account={id:string;provider:"aruba"|"gmail";address:string;status:string};
export default function MailWorkspace({accounts,migrationNeeded}:{accounts:Account[];migrationNeeded:boolean}){
 const [view,setView]=useState<"inbox"|"sent"|"drafts"|"contacts">("inbox");
 const [provider,setProvider]=useState<"all"|"aruba"|"gmail">("all");
 const [compose,setCompose]=useState(false),[draftId,setDraftId]=useState<string|null>(null);
 const [drafts,setDrafts]=useState<Draft[]>([]),[notice,setNotice]=useState("");
 async function loadDrafts(){const r=await fetch("/api/mail/drafts",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Bozze non disponibili");setDrafts(d.items);}
 async function saveDraft(){try{const r=await fetch("/api/mail/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:draftId,accountId:from||null,recipient:to,subject,body})});const d=await r.json();if(!r.ok)throw Error(d.error||"Salvataggio non riuscito");setDraftId(d.id);setNotice("Bozza salvata. Nessuna email inviata.");await loadDrafts();}catch(e){setNotice(e instanceof Error?e.message:"Errore di salvataggio");}}
 const [from,setFrom]=useState("");
 const [to,setTo]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState("");
 const nav=[["inbox","Posta in arrivo"],["sent","Inviate"],["drafts","Bozze"],["contacts","Contatti"]] as const;
 return <section className="mail-workspace">
  <aside className="mail-sidebar">
   <button type="button" className="button" onClick={()=>{setCompose(true);setDraftId(null);setTo("");setSubject("");setBody("");setNotice("");}}>+ Nuovo messaggio</button>
   <nav aria-label="Cartelle posta">{nav.map(([key,label])=><button key={key} type="button" className={view===key?"active":""} onClick={()=>{setView(key);setCompose(false);if(key==="drafts")void loadDrafts().catch(e=>setNotice(e.message));}}>{label}</button>)}</nav>
   <div className="mail-account-filter"><strong>Caselle</strong><label><input type="radio" checked={provider==="all"} onChange={()=>setProvider("all")}/> Tutte le caselle</label>{(["aruba","gmail"] as const).map(p=><label key={p}><input type="radio" checked={provider===p} onChange={()=>setProvider(p)}/> {p==="aruba"?"Aruba · Emme Studio":"Gmail"}</label>)}</div>
  </aside>
  <div className="mail-content">
   {migrationNeeded?<p role="status" className="mail-setup-note">Struttura di sviluppo: migrazione 020 da applicare soltanto nell’ambiente di test.</p>:null}
   <div className="mail-accounts">{(["aruba","gmail"] as const).map(p=>{const list=accounts.filter(a=>a.provider===p);return <div className="mail-account-card" key={p}><strong>{p==="aruba"?"Aruba · Dominio professionale":"Google · Gmail"}</strong><span>{list[0]?.address??"Nessun account configurato"}</span><small>{list[0]?.status==="connected"?"Account collegato":"Connessione da configurare"}</small></div>})}</div>
   {compose?<form className="mail-compose" onSubmit={e=>e.preventDefault()}>
    <h2>Nuovo messaggio</h2><p className="small">Puoi salvare bozze private. L’invio email resta disabilitato finché i collegamenti non saranno collaudati.</p>
    <label>Da<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">Seleziona casella</option>{accounts.filter(a=>a.status==="connected").map(a=><option value={a.id} key={a.id}>{a.address}</option>)}</select></label>
    <label>A<input type="email" value={to} onChange={e=>setTo(e.target.value)} placeholder="destinatario@esempio.it"/></label>
    <label>Oggetto<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Oggetto del messaggio"/></label>
    <label>Messaggio<textarea rows={9} value={body} onChange={e=>setBody(e.target.value)} placeholder="Scrivi la tua email…"/></label>
    <div className="mail-compose-footer"><button type="button" disabled title="Disponibile dopo il collegamento email">Allega preventivo PDF</button><button type="button" onClick={()=>void saveDraft()} disabled={migrationNeeded}>Salva bozza</button><button type="submit" className="button" disabled>Invia email</button></div>
   {notice?<p role="status">{notice}</p>:null}</form>:<section className="mail-empty"><h2>{nav.find(x=>x[0]===view)?.[1]}</h2><p>{provider==="all"?"Vista unificata Aruba + Gmail":provider==="aruba"?"Casella Aruba":"Casella Gmail"}</p>{view==="drafts"?<div className="mail-draft-list">{drafts.map(d=><button type="button" key={d.id} onClick={()=>{setDraftId(d.id);setFrom(d.accountId??"");setTo(d.recipient);setSubject(d.subject);setBody(d.body);setCompose(true);}}><strong>{d.subject||"(Senza oggetto)"}</strong><span>{d.recipient||"Nessun destinatario"} · {new Date(d.updatedAt).toLocaleString("it-IT")}</span></button>)}{!drafts.length?<p>Nessuna bozza salvata.</p>:null}</div>:<p>Questa sezione sarà disponibile dopo il collegamento autorizzato degli account. Non vengono ancora letti o inviati messaggi reali.</p>}{notice?<p role="status">{notice}</p>:null}</section>}
  </div>
 </section>;
}
