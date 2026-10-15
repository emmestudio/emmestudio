"use client";
import {useEffect,useState} from "react";
type Overview={amount:number|null;paid:number|null;balance:number|null;scope:"track"|"project"|null;warning:string|null};
const money=(c:number)=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(c/100);
export default function TrackFinance({trackId}:{trackId:string}){
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/artist-track-finance?trackId="+encodeURIComponent(trackId),{cache:"no-store"}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||"Dati non disponibili");setData(x);}).catch(e=>setError(e.message));},[trackId]);
 return <section className="artist-finance"><h4>Situazione economica e consegna</h4><p className="small">Informazioni riservate allo studio. Il download resta sempre sotto il tuo controllo manuale.</p>
 {data?<><div className="artist-finance-grid"><div><small>Preventivo {data.scope==="project"?"del progetto":"del brano"}</small><strong>{data.amount===null?"Non disponibile":money(data.amount)}</strong></div><div><small>Pagamenti registrati</small><strong>{data.paid===null?"—":money(data.paid)}</strong></div><div><small>Residuo</small><strong>{data.balance===null?"—":money(data.balance)}</strong></div></div>{data.warning?<p className="small" role="status">{data.warning}</p>:null}</>:<p className="small">{error||"Caricamento situazione economica…"}</p>}
 </section>;
}
