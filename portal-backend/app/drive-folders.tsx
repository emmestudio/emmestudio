"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { artistFolders, liveFolders, driveFolderUrl, type DriveFolder, type DriveSubject } from "@/lib/drive-data";
export default function DriveFolders({ kind, id }: {kind: DriveSubject; id: string}) {
  const [folders,setFolders]=useState<DriveFolder[]>([]),[error,setError]=useState("");
  const [permission,setPermission]=useState(true);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[canEdit,setCanEdit]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const c=new AbortController();setLoading(true);setFolders([]);setError("");
    fetch(`/api/drive?kind=${kind}&id=${id}`,{cache:"no-store",signal:c.signal}).then(async r=>{
      const d=await r.json();if(!r.ok)throw Error(d.error);setFolders(d.folders);setCanEdit(d.canEdit);setPermission(d.permission);
    }).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
    return()=>c.abort();
  },[kind,id,revision]);
  async function sync(){setBusy(true);setError("");try{
    const r=await fetch("/api/drive",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sync",kind,id})});const d=await r.json();if(!r.ok)throw Error(d.error);setRevision(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:"Sincronizzazione da riprovare.")}finally{setBusy(false)}}
  const key=`${kind}/${id}`,root=folders.find(f=>f.key===key);
  const expected=kind==="artist"?artistFolders:liveFolders;
  const incomplete=!root || expected.some(([child])=>!folders.some(f=>f.key===`${key}/${child}`&&f.state==="ready"&&!f.error));
  return <section className="drive-panel" aria-label="Materiali su Google Drive">
    <div className="drive-panel-heading"><div><span className="eyebrow">ARCHIVIO CONDIVISO</span><h3>Materiali su Drive</h3></div>{root?.state==="ready"?<a className="secondary" href={driveFolderUrl(root.id)} target="_blank" rel="noopener noreferrer">Apri cartella ↗</a>:null}</div>
    {loading?<p role="status">Verifica cartelle…</p>:<>
      <p className="small">{kind==="live"?"Documenti, band, service e regia: ogni materiale nel proprio ambito.":"Tutto il percorso dell’artista, raccolto in un solo archivio."} Carica i file direttamente nelle cartelle Drive.</p>
      {!permission?<p role="status">L’amministratore deve autorizzare o ricollegare Google Drive dall’Archivio Drive.</p>:null}
      <div className="drive-folder-grid">{expected.map(([child,name])=>{const f=folders.find(f=>f.key===`${key}/${child}`);return f?.state==="ready"?<a key={child} href={driveFolderUrl(f.id)} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">↗</span>{name}</a>:<span className="drive-folder-pending" key={child}>{name}<small>Da creare</small></span>})}</div>
      {(incomplete||root?.error)&&!error?<p className="small">{root?.error || folders.find(f=>f.error)?.error || "Cartelle da collegare. Se l’archivio è attivo, completa la creazione qui sotto."}</p>:null}
      {canEdit?<button className="secondary" disabled={busy} onClick={()=>void sync()}>{busy?"Organizzazione cartelle…":incomplete?"Crea / completa cartelle":"Aggiorna cartelle e nome"}</button>:null}
      <p className="small">I collegamenti rispettano i permessi impostati su Drive. <Link href="/archivio">Impostazioni archivio</Link></p>
    </>}
    <p role="status" aria-live="polite">{error}</p>
  </section>;
}

export function DriveFolderDisclosure({kind,id}:{kind:DriveSubject;id:string}) {
  const [open,setOpen]=useState(false);
  return <details className="live-drive-disclosure" onToggle={e=>setOpen(e.currentTarget.open)}><summary>Archivio Drive · materiali e cartelle ↗</summary>{open?<DriveFolders kind={kind} id={id}/>:null}</details>;
}
