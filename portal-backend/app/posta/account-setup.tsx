"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
type Account={id:string;provider:"aruba"|"gmail";address:string;status:string};
export default function MailAccountSetup({accounts:initial,migrationNeeded}:{accounts:Account[];migrationNeeded:boolean}){
 const router=useRouter();
 const [accounts,setAccounts]=useState(initial),[provider,setProvider]=useState<"aruba"|"gmail">("aruba");
 const [address,setAddress]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [arubaStatus,setArubaStatus]=useState<string|null>(null);
 async function checkArubaSetup(){try{const r=await fetch("/api/mail/aruba/status",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Stato non disponibile");setArubaStatus(d.credentialsConfigured?"Credenziali server configurate; autenticazione e posta non ancora collaudate.":"Credenziali ancora da configurare su Vercel Preview.");}catch(e){setArubaStatus(e instanceof Error?e.message:"Stato non disponibile");}}
 async function checkArubaAuth(){setNotice("Verifica autenticazione IMAP…");try{const r=await fetch("/api/mail/aruba/auth-check",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Verifica non disponibile");setNotice(d.authenticated?"Autenticazione Aruba riuscita. Nessun messaggio letto o inviato.":d.message||"Autenticazione non riuscita");}catch(e){setNotice(e instanceof Error?e.message:"Verifica non disponibile");}}\n async function checkAruba(){setNotice("Verifica TLS in corso…");try{const r=await fetch("/api/mail/aruba/connectivity",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Verifica non disponibile");setNotice("Aruba: IMAP "+(d.imap.ok?"TLS OK":"da verificare")+" · SMTP "+(d.smtp.ok?"TLS OK":"da verificare")+". Nessun accesso alla casella effettuato.");}catch(e){setNotice(e instanceof Error?e.message:"Verifica non disponibile");}}
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/mail/accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider,address})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Operazione non riuscita");
   setAccounts(old=>[...old.filter(x=>x.id!==d.account.id),d.account]);setAddress("");setNotice(d.notice);router.refresh();
  }catch(e){setNotice(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 return <section className="mail-account-setup"><h2>Impostazioni caselle</h2><p className="small">Registra solo gli indirizzi da collegare. Non inserire password o codici OAuth: le connessioni IMAP/SMTP e Google saranno abilitate con un flusso separato e protetto.</p>
  <form onSubmit={save}><label>Provider<select value={provider} onChange={e=>setProvider(e.target.value as "aruba"|"gmail")}><option value="aruba">Aruba — dominio Emme Studio</option><option value="gmail">Gmail / Google Workspace</option></select></label>
  <label>Indirizzo email<input value={address} onChange={e=>setAddress(e.target.value)} type="email" required placeholder={provider==="aruba"?"posta@emmestudioproduction.it":"nome@gmail.com"}/></label>
  <button type="submit" className="button" disabled={migrationNeeded||busy||!address.trim()}>{busy?"Registrazione…":"Registra indirizzo"}</button></form>
  <div className="mail-setup-actions"><button type="button" onClick={()=>void checkArubaSetup()} disabled={busy}>Controlla configurazione Aruba</button><button type="button" onClick={()=>void checkAruba()} disabled={busy}>Verifica connessione TLS Aruba</button><button type="button" onClick={()=>void checkArubaAuth()} disabled={busy}>Verifica accesso IMAP Aruba</button></div>
  {arubaStatus?<p role="status">{arubaStatus}</p>:null}
  {notice?<p role="status">{notice}</p>:null}
  <div className="mail-setup-status">{accounts.length?accounts.map(a=><div key={a.id}><strong>{a.provider==="aruba"?"Aruba":"Gmail"} · {a.address}</strong><span>{a.status==="connected"?"Connessa":"Da collegare (nessun accesso alla posta)"}</span>{a.provider==="gmail"&&a.status!=="connected"?<a href={"/api/mail/google/start?accountId="+encodeURIComponent(a.id)}>Autorizza Gmail</a>:null}</div>):<p>Nessun indirizzo ancora registrato.</p>}</div>
 </section>;
}
