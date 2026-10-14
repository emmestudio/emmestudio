import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { workspaceSession } from "@/lib/workspace-session";
import { listProjects } from "@/lib/projects";
import { listLedger } from "@/lib/finance";
import { quoteHistory } from "@/lib/costs";
import { validId } from "@/lib/task-data";
import { euro, lineTotal } from "@/lib/finance-data";
import PrintButton from "./print-button";
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
    listProjects(s.workspaceOwnerId),
    listLedger(s.workspaceOwnerId),
    quoteHistory(s.workspaceOwnerId, id),
  ]);
  const p = projects.find((p) => p.id === id),
    q = ledger.quotes.find((q) => q.projectId === id);
  if (!p || !q) notFound();
  return (
    <main className="shell quote-document">
      <article className="quote-paper">
      <header className="quote-masthead">
        {/* Native image keeps the printable document independent of image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="Emme Studio" width="150" height="75" />
        <div><span>PROPOSTA DI LAVORO</span><strong>Preventivo</strong><small>Rif. {id.slice(0, 8).toUpperCase()} · v{q.version}</small></div>
      </header>
      <span className="eyebrow">IL TUO PROGETTO, CON EMME STUDIO</span>
      <h1>{p.title}</h1>
      <div className="quote-meta quote-info">
        <p>
          <strong>Artista:</strong> {p.artist}
          <br />
          <strong>Servizio:</strong> {p.service}
          <br />
          <strong>Stato:</strong> {q.status}
        </p>
        <p>
          <strong>Riferimento:</strong> {id.slice(0, 8).toUpperCase()}
          <br />
          <strong>Versione:</strong> {q.version}
          <br />
          <strong>Conferma registrata:</strong>{" "}
          {q.confirmedOn
            ? new Date(q.confirmedOn + "T12:00:00Z").toLocaleDateString("it-IT")
            : "Non registrata"}
          <br />
          {q.confirmationNote}
        </p>
      </div>
      <div className="table-scroll">
        <table className="quote-table">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Quantità</th>
              <th>Tariffa</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {q.items?.length ? (
              q.items.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td>{(l.quantity / 100).toLocaleString("it-IT")}</td>
                  <td>{euro(l.unitPrice)}</td>
                  <td>{euro(lineTotal(l))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td>{p.service}</td>
                <td>1</td>
                <td>{euro(q.amount)}</td>
                <td>{euro(q.amount)}</td>
              </tr>
            )}
          </tbody>
          <tfoot className="quote-table-total">
            <tr>
              <th colSpan={3}>Totale preventivo</th>
              <td>{euro(q.amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="quote-total"><div><span>INVESTIMENTO COMPLESSIVO</span><p>Totale preventivo</p></div><strong>{euro(q.amount)}</strong></div>
      <section className="quote-conditions">
        <h2>Dettaglio e condizioni</h2>
        <p className="preserve-lines">
          {q.notes || "Condizioni da specificare."}
        </p>
      </section>
      <footer className="quote-footer"><strong>EMME STUDIO</strong><span>Music Production · Live Show Production · Artist &amp; Project Management</span></footer>
      </article>
      <div className="dialog-actions no-print">
        <PrintButton />
        <Link className="text-button" href={"/progetti?project=" + id}>
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
