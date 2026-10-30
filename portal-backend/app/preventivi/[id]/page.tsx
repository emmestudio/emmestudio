import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { workspaceSession } from "@/lib/workspace-session";
import {listFinanceTargets} from "@/lib/finance-targets";
import { listLedger } from "@/lib/finance";
import { quoteHistory } from "@/lib/costs";
import { validId } from "@/lib/task-data";
import { euro } from "@/lib/finance-data";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await workspaceSession(await headers());
  if (!s) redirect("/accesso");
  if (s.role !== "admin") redirect("/dashboard");
  const { id } = await params;
  if (!validId(id)) notFound();
  const [projects, ledger, history] = await Promise.all([
    listFinanceTargets(s.workspaceOwnerId),
    listLedger(s.workspaceOwnerId),
    quoteHistory(s.workspaceOwnerId, id),
  ]);
  const p = projects.find((p) => p.id === id),
    q = ledger.quotes.find((q) => q.projectId === id);
  if (!p || !q) notFound();
  return (
    <main className="shell quote-document">
      <header className="card no-print"><p className="eyebrow">PREVENTIVO · EMME STUDIO</p><h1>{p.title}</h1><p>{p.artist} · {p.service} · {euro(q.amount)}</p><p>Lo stesso documento viene utilizzato per progetti, prenotazioni e allegati email.</p></header>
      <iframe className="quote-pdf-preview" title={"Preventivo PDF — "+p.title} src={"/api/finance/quote?id="+id} />
      <div className="dialog-actions no-print">
        <a className="button" href={"/api/finance/quote?id="+id} target="_blank" rel="noopener noreferrer">Apri / Scarica PDF</a>
        <Link className="text-button" href={p.subjectKind === "project" ? "/progetti?project="+id : "/produzione?kind="+p.productionKind+"&artist="+p.artistId+(p.productionKind==="track"?"&track="+id:"")}>
          Modifica preventivo ↗
        </Link>
      </div>
      <details className="card no-print">
        <summary>Cronologia del preventivo · {history.length} versioni</summary>
        {history.map((h) => (
          <div className="ledger-row" key={h.revision}>
            <div>
              <strong>
                v{h.revision} · {h.snapshot.status} · {euro(h.snapshot.amount)}
              </strong>
              <p>
                {new Date(h.recordedAt).toLocaleString("it-IT", {
                  timeZone: "Europe/Rome",
                })}
              </p>
              <p className="preserve-lines">{h.snapshot.notes}</p>
              {h.snapshot.items?.map(
                (
                  l: {
                    description: string;
                    quantity: number;
                    unitPrice: number;
                  },
                  i: number,
                ) => (
                  <p key={i}>
                    {l.description} · {l.quantity / 100} × {euro(l.unitPrice)}
                  </p>
                ),
              )}
            </div>
          </div>
        ))}
      </details>
    </main>
  );
}
