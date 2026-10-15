"use client";
import {useEffect,useState} from "react";
type Item={id:string;title:string;status:string;expiresAt:string;eligible:boolean};
export default function RetentionTest(){
 const [items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function load(){const r=await fetch("/api/artist-retention-preview",{cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error||"Verifica non disponibile");setItems(d.items);}
 useEffect(()=>{load().catch(e=>setMessage(String(e)));},[]);
 async function execute(){
  const item=items.find(i=>i.id===selected);if(!item||!/(^|[ _-])test([ _.-]|$)/i.test(item.title))return;
  if(!confirm("SIMULAZIONE: spostare SOLO «"+item.title+"» nel cestino Drive e contrassegnarla eliminata nel portale?"))return;
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/artist-retention-test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({previewId:item.id,confirm:"SIMULA SCADENZA TEST"})});
   const d=await r.json();if(!r.ok)throw Error(d.error||"Operazione non riuscita");setMessage("Test completato. Verifica il cestino Drive e la scomparsa dall'elenco.");setSelected("");await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Errore");}finally{setBusy(false);}
 }
 const selectable=items.filter(i=>/(^|[ _-])test([ _.-]|$)/i.test(i.title));
 return <section className="card"><h1>Collaudo pulizia anteprime</h1><p>La simulazione non cambia le date: sposta nel cestino soltanto una versione già ritirata con TEST nel nome, previa conferma. Non usarla per materiale reale.</p><label>Anteprima di prova<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleziona un file contrassegnato TEST</option>{selectable.map(i=><option value={i.id} key={i.id}>{i.title} · scadenza {new Date(i.expiresAt).toLocaleDateString("it-IT")}</option>)}</select></label>{!selectable.length?<p role="status">Nessuna anteprima idonea al test. Il filtro richiede che il nome del file contenga TEST (ad esempio TEST Mix v01.mp3), che sia stata sostituita e non già eliminata.</p>:null}{items.length>0&&!selectable.length?<div><h3>Anteprime ritirate trovate, ma non abilitate al test</h3>{items.map(i=><p key={i.id}>{i.title} — manca TEST nel nome del file</p>)}</div>:null}<button className="button" disabled={!selected||busy} onClick={()=>void execute()}>Simula scadenza del file TEST selezionato</button>{message?<p role="status">{message}</p>:null}</section>;
}
