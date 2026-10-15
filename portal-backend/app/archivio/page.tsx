import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import Archive from "./archive";
export const dynamic="force-dynamic";
export default async function Page(){
  const s=await workspaceSession(await headers());if(!s)redirect("/accesso");
  return <main className="shell dashboard"><span className="eyebrow">EMME STUDIO · ARCHIVIO</span><h1>Ogni materiale.<br/><em>Al suo posto.</em></h1>{s.role==="admin"?<Archive/>:<p>L’archivio è gestito dall’amministratore. Apri le cartelle dalle schede artisti e produzioni live; l’accesso ai file dipende dalle condivisioni su Drive.</p>}</main>;
}
