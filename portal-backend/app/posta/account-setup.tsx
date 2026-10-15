"use client";
import {useState} from "react";
type Account={id:string;provider:"aruba"|"gmail";address:string;status:string};
export default function MailAccountSetup({accounts:initial,migrationNeeded}:{accounts:Account[];migrationNeeded:boolean}){
 const [accounts,setAccounts]=useState(initial),[provider,setProvider]=useState<"aruba"|"gmail">("aruba");
 const [address,setAddress]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/mail/accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider,address})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Operazione non riuscita");
   setAccounts(old=>[...old.filter(x=>x.id!==d.account.id),d.account]);setAddress("");setNotice(d.notice);
  }catch(e){setNotice(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 return <section className="mail-account-setup"><h2>Impostazioni caselle</h2><p className="small">Registra solo gli indirizzi da collegare. Non inserire password o codici OAuth: le connessioni IMAP/SMTP e Google saranno abilitate con un flusso separato e protetto.</p>
  <form onSubmit={save}><label>Provider<select value={provider} onChange={e=>setProvider(e.target.value as "aruba"|"gmail")}><option value="aruba">Aruba — dominio Emme Studio</option><option value="gmail">Gmail / Google Workspace</option></select></label>
  <label>Indirizzo email<input value={address} onChange={e=>setAddress(e.target.value)} type="email" required placeholder={provider==="aruba"?"posta@emmestudioproduction.it":"nome@gmail.com"}/></label>
  <button type="submit" className="button" disabled={migrationNeeded||busy||!address.trim()}>{busy?"Registrazione…":"Registra indirizzo"}</button></form>
  {notice?<p role="status">{notice}</p>:null}
  <div className="mail-setup-status">{accounts.length?accounts.map(a=><div key={a.id}><strong>{a.provider==="aruba"?"Aruba":"Gmail"} · {a.address}</strong><span>{a.status==="connected"?"Connessa":"Da collegare (nessun accesso alla posta)"}</span></div>):<p>Nessun indirizzo ancora registrato.</p>}</div>
 </section>;
}
