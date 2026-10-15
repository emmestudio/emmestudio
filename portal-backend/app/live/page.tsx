import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import Production from "../produzione/production";
export const dynamic="force-dynamic";
export default async function Page(){
 if(!(await workspaceSession(await headers())))redirect("/accesso");
 return <main className="shell dashboard"><span className="eyebrow">EMME STUDIO · LIVE SHOW PRODUCTION</span><h1>Dal progetto.<br/><em>Al palco.</em></h1><Production liveOnly/></main>;
}
