import ArtistLogin from "./artist-login";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceSession } from "@/lib/workspace-session";
import { configurationReady } from "@/lib/config";
import Login from "./login";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await workspaceSession(await headers())) redirect("/dashboard");
  const params = await searchParams;
  return <main className="shell portal-login">
    <span className="eyebrow">EMME STUDIO · ACCESSO RISERVATO</span>
    <h1>Il tuo spazio. <em>La tua musica.</em></h1>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))",gap:20,marginTop:30}}>
      <section className="card"><span className="eyebrow">AREA ARTISTI</span>
        <h2>Le tue produzioni.</h2>
        <p>Accedi con l'account Google associato all'email abilitata dallo studio. Visualizza i materiali autorizzati per il tuo progetto.</p>
        <ArtistLogin/>
      </section>
      <section className="card"><span className="eyebrow">AREA TEAM</span>
        <h2>Il lavoro dello studio.</h2>
        <p>Accesso riservato ad amministratore e collaboratori autorizzati.</p>
        {configurationReady()?<Login/>:<p>Accesso temporaneamente non disponibile.</p>}
      </section>
    </div>
    {params.error?<p role="alert">Accesso non completato. Verifica che il tuo account sia abilitato.</p>:null}
  </main>;
}
