import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { configurationReady, ownerAllowed } from "@/lib/config";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configurationReady()) redirect("/accesso");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || !ownerAllowed(session.user.email, session.user.emailVerified)) redirect("/accesso");
  return <main className="shell"><span className="eyebrow">EMME STUDIO · CALENDARIO</span><h1>Spazio al<br /><em>prossimo incontro.</em></h1><div className="card"><span className="badge">SINCRONIZZAZIONE NON ATTIVA</span><h2>Accesso verificato</h2><p>Il calendario dedicato sarà collegato nella prossima fase. Nessun appuntamento dimostrativo verrà trasferito nel tuo calendario.</p></div></main>;
}
