"use client";
import {useMemo,useState} from "react";
type Preview={id:string;title:string;version_label:string;status:string;feedback:string|null;artist_name:string;track_name:string};
const states:Record<string,{label:string;color:string}>={
 draft:{label:"Bozza",color:"#a1a1aa"},
 ready:{label:"Disponibile all'ascolto",color:"#67e8f9"},
 approved:{label:"Approvata",color:"#4ade80"},
 revision_requested:{label:"Revisione richiesta",color:"#fbbf24"},
 withdrawn:{label:"Ritirata",color:"#f87171"}
};
export default function PreviewRegister({initial}: {initial:Preview[]}){
 const [items,setItems]=useState(initial),[busy,setBusy]=useState(""),[error,setError]=useState(""),[filter,setFilter]=useState("");
 const groups=useMemo(()=>{
  const map=new Map<string,Map<string,Preview[]>>();
  for(const x of items.filter(x=>(x.artist_name+" "+x.track_name+" "+x.title+" "+x.version_label).toLowerCase().includes(filter.toLowerCase()))){
   const artist=x.artist_name||"Artista senza nome",track=x.track_name||"Brano senza titolo";
   if(!map.has(artist))map.set(artist,new Map());
   const songs=map.get(artist)!;if(!songs.has(track))songs.set(track,[]);
   songs.get(track)!.push(x);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],"it")).map(([artist,songs])=>({artist,songs:[...songs.entries()].sort((a,b)=>a[0].localeCompare(b[0],"it"))}));
 },[items,filter]);
 async function change(id:string,status:string){
  setBusy(id);setError("");
  try{const r=await fetch("/api/artist-previews",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});const d=await r.json();if(!r.ok)throw Error(d.error||"Impossibile modificare lo stato");window.location.reload();}
  catch(e){setError(e instanceof Error?e.message:"Errore di salvataggio");}finally{setBusy("")}
 }
 async function remove(x:Preview){
  if(!window.confirm('Eliminare definitivamente la versione "'+x.title+'" ('+x.version_label+') di '+x.artist_name+'? Non sarà più visibile nel portale o nell’Area Artista. Il file originale su Google Drive non verrà eliminato.'))return;
  setBusy(x.id);setError("");
  try{const r=await fetch("/api/artist-previews",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:x.id,confirm:true})});const d=await r.json();if(!r.ok)throw Error(d.error||"Eliminazione non riuscita");setItems(old=>old.filter(v=>v.id!==x.id));}
  catch(e){setError(e instanceof Error?e.message:"Errore di eliminazione");}finally{setBusy("")}
 }
 return <section className="card preview-register">
 <div className="preview-register-head"><div><h2>Versioni registrate</h2><p className="small">{items.length} versioni · organizzate per artista e brano</p></div><label className="preview-register-search">Cerca artista o brano<input type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Cerca nel registro…"/></label></div>
 {error?<p role="alert" style={{color:"#fca5a5"}}>{error}</p>:null}
 {!groups.length?<p>Nessuna anteprima trovata.</p>:groups.map(g=><section key={g.artist} className="preview-register-artist">
 <h3 style={{borderBottom:"1px solid #444",paddingBottom:10}}>{g.artist}</h3>
 {g.songs.map(([song,versions])=><div key={song} className="preview-register-song">
 <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong style={{fontSize:"1.05rem"}}>{song}</strong><small>{versions.length} {versions.length===1?"versione":"versioni"}</small></div>
 {versions.map(v=><div key={v.id} className="preview-register-version">
 <div className="preview-register-file"><strong>{v.title}</strong><p className="small">{v.version_label}</p>{v.feedback?<p className="small">Feedback: {v.feedback}</p>:null}</div>
 <div className="preview-register-actions">
 <span style={{padding:"5px 10px",border:"1px solid currentColor",borderRadius:99,color:states[v.status]?.color??"#ddd",fontSize:12}}>{states[v.status]?.label??v.status}</span>
 <select aria-label={"Modifica stato "+v.title} value={v.status} onChange={e=>void change(v.id,e.target.value)} disabled={busy===v.id}>{Object.entries(states).map(([key,s])=><option key={key} value={key}>{s.label}</option>)}</select>
 <button type="button" className="secondary" style={{color:"#fca5a5",borderColor:"#854747"}} onClick={()=>void remove(v)} disabled={busy===v.id}>{busy===v.id?"Attendi…":"Elimina definitivamente"}</button>
 </div></div>)}
 </div>)}
 </section>)}
 </section>;
}
