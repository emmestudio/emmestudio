import Link from "next/link";
import { configurationReady } from "@/lib/config";
import Login from "./login";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="shell"><Link href="/" className="eyebrow">← EMME STUDIO</Link><h1>Il lavoro prende<br /><em>forma insieme.</em></h1><div className="card"><h2>Accesso al portale</h2><p>Usa l’account Google abilitato dall’amministratore dello studio. I permessi dipendono dal ruolo assegnato.</p>{params.error && <p role="alert">Accesso non completato. Controlla di aver scelto l’email abilitata e, durante la fase di test, inclusa fra i tester Google.</p>}{configurationReady() ? <Login /> : <p className="badge">Collegamento Google in configurazione</p>}</div></main>;
}
