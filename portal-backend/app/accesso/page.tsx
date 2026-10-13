import Link from "next/link";
import { configurationReady } from "@/lib/config";
import Login from "./login";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="shell"><Link href="/" className="eyebrow">← EMME STUDIO</Link><h1>Il lavoro prende<br /><em>forma insieme.</em></h1><div className="card"><h2>Accesso amministratore</h2><p>In questa prima fase l’accesso è riservato all’account Google verificato dello studio. Gli accessi del team verranno aggiunti successivamente.</p>{params.error && <p role="alert">Google non ha completato l’accesso. Controlla di aver scelto l’account abilitato.</p>}{configurationReady() ? <Login /> : <p className="badge">Collegamento Google in configurazione</p>}</div></main>;
}
