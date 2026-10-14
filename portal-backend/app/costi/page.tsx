import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import Costs from "./costs";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await workspaceSession(await headers());
  if (!s) redirect("/accesso");
  if (s.role !== "admin") redirect("/dashboard");
  return (
    <main className="shell dashboard">
      <span className="eyebrow">EMME STUDIO · CONTROLLO ECONOMICO</span>
      <h1>
        Costi chiari.
        <br />
        <em>Decisioni più consapevoli.</em>
      </h1>
      <Costs />
    </main>
  );
}
