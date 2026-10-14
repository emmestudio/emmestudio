import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import Finance from "./finance";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await workspaceSession(await headers());
  if (!s) redirect("/accesso");
  if (s.role !== "admin") redirect("/dashboard");
  return (
    <main className="shell">
      <span className="eyebrow">EMME STUDIO · CONTROLLO ECONOMICO</span>
      <h1>
        Il valore del lavoro.
        <br />
        <em>Ogni cifra sotto controllo.</em>
      </h1>
      <Finance />
    </main>
  );
}
