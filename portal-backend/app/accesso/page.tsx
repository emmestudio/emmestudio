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
  return (
    <main className="shell portal-login">
      <a href="https://emmestudioproduction.it/" className="eyebrow">
        ← TORNA A EMME STUDIO
      </a>
      <div className="login-intro">
        <span className="badge">AREA RISERVATA AL TEAM</span>
        <h1>
          La prossima sessione.
          <br />
          <em>Il prossimo passo.</em>
        </h1>
        <p>Accedi allo spazio di lavoro condiviso dello studio.</p>
      </div>
      <section className="card login-card">
        <h2>Benvenuto nel team.</h2>
        <p>
          Continua con il tuo account Google abilitato. Troverai i progetti e
          gli strumenti previsti dal tuo ruolo.
        </p>
        {params.error ? (
          <p className="login-error" role="alert">
            Accesso non completato. Scegli l’account abilitato; se il problema
            persiste, chiedi all’amministratore di verificare l’accesso.
          </p>
        ) : null}
        {configurationReady() ? (
          <Login />
        ) : (
          <p role="status">
            Accesso momentaneamente non disponibile. Riprova più tardi.
          </p>
        )}
        <p className="small">
          Il portale è riservato allo studio e ai suoi collaboratori. I profili
          artista vengono gestiti dal team.
        </p>
      </section>
    </main>
  );
}
