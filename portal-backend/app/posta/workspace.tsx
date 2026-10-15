"use client";
import {useState} from "react";
type Account={id:string;provider:"aruba"|"gmail";address:string;status:string};
export default function MailWorkspace({accounts,migrationNeeded}:{accounts:Account[];migrationNeeded:boolean}){
 const [view,setView]=useState<"inbox"|"sent"|"drafts"|"contacts">("inbox");
 const [provider,setProvider]=useState<"all"|"aruba"|"gmail">("all");
 const [compose,setCompose]=useState(false);
 const [from,setFrom]=useState("");
 const [to,setTo]=useState(""),[subject,setSubject]=useState(""),[body,setBody]=useState("");
 const nav=[["inbox","Posta in arrivo"],["sent","Inviate"],["drafts","Bozze"],["contacts","Contatti"]] as const;
 return <section className="mail-workspace">
  <aside className="mail-sidebar">
   <button type="button" className="button" onClick={()=>setCompose(true)}>+ Nuovo messaggio</button>
   <nav aria-label="Cartelle posta">{nav.map(([key,label])=><button key={key} type="button" className={view===key?"active":""} onClick={()=>{setView(key);setCompose(false);}}>{label}</button>)}</nav>
   <div className="mail-account-filter"><strong>Caselle</strong><label><input type="radio" checked={provider==="all"} onChange={()=>setProvider("all")}/> Tutte le caselle</label>{(["aruba","gmail"] as const).map(p=><label key={p}><input type="radio" checked={provider===p} onChange={()=>setProvider(p)}/> {p==="aruba"?"Aruba · Emme Studio":"Gmail"}</label>)}</div>
  </aside>
  <div className="mail-content">
   {migrationNeeded?<p role="status" className="mail-setup-note">Struttura di sviluppo: migrazione 020 da applicare soltanto nell’ambiente di test.</p>:null}
   <div className="mail-accounts">{(["aruba","gmail"] as const).map(p=>{const list=accounts.filter(a=>a.provider===p);return <div className="mail-account-card" key={p}><strong>{p==="aruba"?"Aruba · Dominio professionale":"Google · Gmail"}</strong><span>{list[0]?.address??"Nessun account configurato"}</span><small>{list[0]?.status==="connected"?"Account collegato":"Connessione da configurare"}</small></div>})}</div>
   {compose?<form className="mail-compose" onSubmit={e=>e.preventDefault()}>
    <h2>Nuovo messaggio</h2><p className="small">Composizione di anteprima. Invio e salvataggio disabilitati finché i collegamenti non sono pronti.</p>
    <label>Da<select value={from} onChange={e=>setFrom(e.target.value)}><option value="">Seleziona casella</option>{accounts.filter(a=>a.status==="connected").map(a=><option value={a.id} key={a.id}>{a.address}</option>)}</select></label>
    <label>A<input type="email" value={to} onChange={e=>setTo(e.target.value)} placeholder="destinatario@esempio.it"/></label>
    <label>Oggetto<input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Oggetto del messaggio"/></label>
    <label>Messaggio<textarea rows={9} value={body} onChange={e=>setBody(e.target.value)} placeholder="Scrivi la tua email…"/></label>
    <div className="mail-compose-footer"><button type="button" disabled title="Disponibile dopo il collegamento email">Allega preventivo PDF</button><button type="submit" className="button" disabled>Invia email</button></div>
   </form>:<section className="mail-empty"><h2>{nav.find(x=>x[0]===view)?.[1]}</h2><p>{provider==="all"?"Vista unificata Aruba + Gmail":provider==="aruba"?"Casella Aruba":"Casella Gmail"}</p><p>Questa sezione sarà disponibile dopo il collegamento autorizzato degli account. Non vengono ancora letti o inviati messaggi reali.</p></section>}
  </div>
 </section>;
}
