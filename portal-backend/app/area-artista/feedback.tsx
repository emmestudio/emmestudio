"use client";
import {useState} from "react";
export default function Feedback({id,status}:{id:string;status:string}){
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function submit(action:"approve"|"revision"){
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/artist-feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({previewId:id,action,feedback:message})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Operazione non riuscita");
   window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:"Riprova");}finally{setBusy(false);}
 }
 if(status==="approved")return <p className="small">Versione approvata.</p>;
 return <div>
  <label>Note e richieste di modifica<textarea value={message} maxLength={4000} rows={3} onChange={e=>setMessage(e.target.value)} placeholder="Descrivi gli interventi richiesti"/></label>
  <div className="dialog-actions">
   <button type="button" className="button" disabled={busy} onClick={()=>void submit("approve")}>Approva versione</button>
   <button type="button" className="secondary" disabled={busy||!message.trim()} onClick={()=>void submit("revision")}>Richiedi revisione</button>
  </div>
  {error?<p role="alert">{error}</p>:null}
 </div>;
}
