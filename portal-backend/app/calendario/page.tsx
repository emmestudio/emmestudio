import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { configurationReady, ownerAllowed } from "@/lib/config";
import Connection from './connection';
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configurationReady()) redirect("/accesso");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || !ownerAllowed(session.user.email, session.user.emailVerified)) redirect("/accesso");
  return <main className="shell"><span className="eyebrow">EMME STUDIO · CALENDARIO</span><h1>Spazio al<br /><em>prossimo incontro.</em></h1><Connection /></main>;
}
