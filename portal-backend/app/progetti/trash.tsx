"use client";
import { useEffect, useState } from "react";
type Item = {
  id: string;
  kind: string;
  version: number;
  title: string;
  deletedAt: string;
};
export default function Trash({ onRestored }: { onRestored: () => void }) {
  const [items, setItems] = useState<Item[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/operations", { signal: c.signal, cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setItems(d.items);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [refresh]);
  async function restore(p: Item) {
    setBusy(p.id);
    try {
      const r = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          kind: p.kind,
          id: p.id,
          version: p.version,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setRefresh((n) => n + 1);
      onRestored();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ripristino non completato.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="card">
      <h2>Cestino dello studio</h2>
      <p>
        I contenuti rimossi sono ripristinabili. Ripristina prima artista,
        progetto e brano, poi le schede collegate. Le schede nascoste dalla
        rimozione di un progetto o brano tornano visibili con il relativo
        ripristino.
      </p>
      <p role="status">{error}</p>
      {items.map((p) => (
        <div className="ledger-row" key={p.kind + p.id}>
          <div>
            <strong>{p.title}</strong>
            <p>
              {{
                project: "Progetto",
                production: "Produzione",
                task: "Attività",
                artist: "Artista",
              }[p.kind] || p.kind}{" "}
              · {new Date(p.deletedAt).toLocaleDateString("it-IT")}
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={Boolean(busy)}
            onClick={() => void restore(p)}
          >
            {busy === p.id ? "Ripristino…" : "Ripristina"}
          </button>
        </div>
      ))}
      {!items.length && !error ? <p>Il cestino è vuoto.</p> : null}
    </section>
  );
}
