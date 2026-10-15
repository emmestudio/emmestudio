import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {workspaceSession} from "@/lib/workspace-session";
export const dynamic="force-dynamic";
export default async function Page() {
 const session=await workspaceSession(await headers());
 if(!session)redirect("/accesso");
 if(session.role!=="admin")redirect("/dashboard");
 return <main className="shell dashboard">
  <span className="eyebrow">EMME STUDIO · ANTEPRIME</span>
  <h1>Anteprime <em>artisti.</em></h1>
  <section className="card"><h2>Archivio protetto</h2>
  <p>Il registro delle anteprime è riservato all’amministratore. Non condividere i master originali.</p>
  <p>La riproduzione esterna non è ancora abilitata. Le API amministrative consentono di registrare le versioni e cambiarne lo stato.</p>
  </section>
 </main>;
}