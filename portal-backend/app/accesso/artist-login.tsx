"use client";
import {useState} from "react";
import {authClient} from "@/lib/auth-client";
export default function ArtistLogin(){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 return <><button className="button" disabled={busy} onClick={async()=>{
  setBusy(true);setError("");
  try{
   const result=await authClient.signIn.social({provider:"google",callbackURL:"/area-artista",errorCallbackURL:"/accesso?area=artista&error=1"});
   if(result.error){setError("Accesso non riuscito: verifica che l'email Google sia autorizzata dallo studio.");setBusy(false);}
  }catch{setError("Connessione non disponibile.");setBusy(false);}
 }}>{busy?"Apertura Google…":"Entra nell'Area Artista con Google"}</button>
 {error?<p role="alert">{error}</p>:null}</>;
}
