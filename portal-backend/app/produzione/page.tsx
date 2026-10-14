import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import Production from "./production";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await workspaceSession(await headers()))) redirect("/accesso");
  return (
    <main className="shell dashboard">
      <span className="eyebrow">EMME STUDIO · WORKSPACE INTERNO</span>
      <h1>
        Dalla prima idea.
        <br />
        <em>Alla consegna finale.</em>
      </h1>
      <Production />
    </main>
  );
}
