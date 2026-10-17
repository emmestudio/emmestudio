"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useRef,useState} from "react";
import {authClient} from "@/lib/auth-client";
type NavItem={href:string;label:string};
type NavGroup={label:string;items:NavItem[]};
const entry=(href:string,label:string):NavItem=>({href,label});
export default function Navigation(){
 const pathname=usePathname();
 const container=useRef<HTMLDivElement>(null);
 const [admin,setAdmin]=useState(false),[owner,setOwner]=useState(false),[signedIn,setSignedIn]=useState(false),[open,setOpen]=useState(false),[expanded,setExpanded]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  setOpen(false);setExpanded(null);setSignedIn(false);setAdmin(false);setOwner(false);
  fetch("/api/workspace",{cache:"no-store",signal:controller.signal}).then(async r=>{
   if(!r.ok)return;
   const d=await r.json();setSignedIn(true);setAdmin(Boolean(d.canManageAccess));setOwner(Boolean(d.canManageAccess));
  }).catch(()=>{});
  return ()=>controller.abort();
 },[pathname]);
 useEffect(()=>{
  if(!open&&!expanded)return;
  const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!container.current?.contains(e.target)){setOpen(false);setExpanded(null);}};
  const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);setExpanded(null);}};
  document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
  return ()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
 },[open,expanded]);
 const artistArea=pathname.startsWith("/area-artista");
 const groups:NavGroup[]=[
  {label:"Produzioni",items:[entry("/progetti","Progetti"),entry("/produzione","Produzione musicale"),entry("/live","Produzione Live"),...(admin?[entry("/anteprime","Anteprime artisti")]:[])]},
  {label:"Organizzazione",items:[entry("/lavoro","Il mio lavoro"),entry("/attivita","Attività"),entry("/calendario","Calendario")]},
  ...(admin?[{label:"Amministrazione",items:[entry("/guadagni","Guadagni"),entry("/costi","Costi"),entry("/archivio","Archivio Drive"),entry("/accessi","Team e accessi")]}]:[])
 ];
 const active=(href:string)=>pathname===href||pathname.startsWith(href+"/")||(href==="/progetti"&&pathname.startsWith("/preventivi/"));
 function link(item:NavItem){return <Link key={item.href} href={item.href} aria-current={active(item.href)?"page":undefined} onClick={()=>{setOpen(false);setExpanded(null);}}>{item.label}</Link>;}
 async function signOut(){
  setBusy(true);setError("");
  try{const r=await authClient.signOut();if(r.error)throw Error();window.location.assign("/accesso");}
  catch{setError("Uscita non completata. Riprova.");setBusy(false);}
 }
 return <div className="portal-navigation portal-navigation-v2" ref={container}>
  <button type="button" className="portal-menu-toggle secondary" aria-controls="portal-links" aria-expanded={open} onClick={()=>setOpen(!open)}>Menu <span aria-hidden="true">{open?"×":"☰"}</span></button>
  <nav id="portal-links" className={open?"is-open":""} aria-label="Navigazione portale">
   {artistArea?link(entry("/area-artista","Area Artista")):signedIn?<>{link(entry("/dashboard","Panoramica"))}{link(entry("/artisti","Artisti"))}
    {groups.map(group=><div className="portal-nav-group" key={group.label}>
     <button type="button" className="portal-nav-trigger" aria-expanded={expanded===group.label} aria-haspopup="menu" onClick={()=>setExpanded(expanded===group.label?null:group.label)} data-active={group.items.some(i=>active(i.href))?"true":undefined}>{group.label}<span aria-hidden="true" className="portal-nav-indicator"><span className="portal-nav-indicator-line"/></span></button>
     {expanded===group.label?<div className="portal-nav-dropdown">{group.items.map(link)}</div>:null}
    </div>)}
    {signedIn?<div className="portal-nav-group"><button type="button" className="portal-nav-trigger" aria-expanded={expanded==="posta"} onClick={()=>setExpanded(expanded==="posta"?null:"posta")} data-active={pathname.startsWith("/posta")||pathname.startsWith("/messaggi-artisti")?"true":undefined}>Posta <span className="portal-nav-indicator" aria-hidden="true"><span className="portal-nav-indicator-line"/></span></button>{expanded==="posta"?<div className="portal-nav-dropdown">{owner?link(entry("/posta","Caselle email")):null}{link(entry("/messaggi-artisti","Messaggi artisti"))}</div>:null}</div>:null}
   </>:link(entry("/accesso","Accesso team"))}
   <div className="portal-nav-group portal-nav-account">
    <button type="button" className="portal-nav-trigger" aria-expanded={expanded==="account"} onClick={()=>setExpanded(expanded==="account"?null:"account")}>Account <span aria-hidden="true" className="portal-nav-indicator"><span className="portal-nav-indicator-line"/></span></button>
    {expanded==="account"?<div className="portal-nav-dropdown portal-nav-dropdown-right">
     {link(entry("/installa","Installa app"))}
     <a href="https://emmestudioproduction.it/" target="_blank" rel="noopener noreferrer">Sito Emme Studio ↗</a>
     {signedIn?<button className="portal-nav-exit" type="button" onClick={()=>void signOut()} disabled={busy}>{busy?"Uscita…":"Esci"}</button>:null}
    </div>:null}
   </div>
  </nav>{error?<p className="navigation-error" role="alert">{error}</p>:null}
 </div>;
}
