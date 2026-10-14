import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import Artists from "./artists";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await workspaceSession(await headers()))) redirect("/accesso");
  return (
    <main className="shell">
      <span className="eyebrow">EMME STUDIO · ARTIST MANAGEMENT</span>
      <h1>
        Ogni artista.
        <br />
        <em>Un percorso da costruire.</em>
      </h1>
      <Artists />
    </main>
  );
}
