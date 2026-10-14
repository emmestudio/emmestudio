import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import Work from "./work";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await workspaceSession(await headers()))) redirect("/accesso");
  return (
    <main className="shell dashboard">
      <span className="eyebrow">EMME STUDIO · ORGANIZZAZIONE DEL TEAM</span>
      <h1>
        Il lavoro al posto giusto.
        <br />
        <em>Ogni giorno.</em>
      </h1>
      <Work />
    </main>
  );
}
