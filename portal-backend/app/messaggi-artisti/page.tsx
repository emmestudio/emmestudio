import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {workspaceSession} from "@/lib/workspace-session";
import Conversations from "./conversations";
export const dynamic="force-dynamic";
export default async function Page(){
 const s=await workspaceSession(await headers());
 if(!s)redirect("/accesso");
 return <main className="shell dashboard"><span className="eyebrow">EMME STUDIO · COMUNICAZIONI</span><h1>Messaggi <em>artisti.</em></h1><p>Una conversazione per artista, con messaggi e avvenimenti organizzati per brano.</p><Conversations/></main>;
}