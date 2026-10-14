"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type StudioProject } from "@/lib/project-data";
import {
  moneyInput,
  euro,
  projectBalance,
  type Ledger,
} from "@/lib/finance-data";
import {
  costStates,
  costCategories,
  costSummary,
  type StudioCost,
  type CostDraft,
} from "@/lib/cost-data";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const empty = (projectId = ""): CostDraft => ({
  projectId,
  description: "",
  supplier: "",
  category: "Collaboratori",
  amount: 0,
  status: "Previsto",
  dueDate: null,
  paidDate: null,
  notes: "",
});
export default function Costs() {
  const [projects, setProjects] = useState<StudioProject[]>([]),
    [costs, setCosts] = useState<StudioCost[]>([]),
    [ledger, setLedger] = useState<Ledger>({
      quotes: [],
      payments: [],
      installments: [],
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [project, setProject] = useState(""),
    [filter, setFilter] = useState("Tutti");
  const [editor, setEditor] = useState<StudioCost | "new" | null>(null),
    [draft, setDraft] = useState<CostDraft>(empty()),
    [amount, setAmount] = useState(""),
    [id, setId] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [history, setHistory] = useState<
      { version: number; snapshot: CostDraft; recordedAt: string }[]
    >([]),
    [historyError, setHistoryError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    initial = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    Promise.all(
      ["/api/projects", "/api/costs", "/api/finance"].map(async (url) => {
        const r = await fetch(url, { cache: "no-store", signal: c.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    )
      .then(([p, c, l]) => {
        setProjects(p.projects);
        setCosts(c.costs);
        setLedger(l);
        setError("");
        if (!initial.current) {
          initial.current = true;
          setProject(
            new URLSearchParams(window.location.search).get("project") ?? "",
          );
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    if (editor && !dialog.current?.open) dialog.current?.showModal();
    setHistory([]);
    setHistoryError("");
    if (!editor || editor === "new") return;
    const c = new AbortController();
    fetch("/api/costs?history=" + editor.id, {
      signal: c.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setHistory(d.history);
      })
      .catch((e) => {
        if (!c.signal.aborted) setHistoryError(e.message);
      });
    return () => c.abort();
  }, [editor]);
  function open(c?: StudioCost) {
    setEditor(c ?? "new");
    setDraft(c ? { ...c } : empty(project));
    setAmount(c ? (c.amount / 100).toFixed(2) : "");
    setId(c?.id ?? crypto.randomUUID());
    setFormError("");
  }
  function close() {
    if (!busy) {
      dialog.current?.close();
      setEditor(null);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/costs", {
        method: editor === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          version: editor && editor !== "new" ? editor.version : undefined,
          draft: { ...draft, amount: moneyInput(amount) },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      dialog.current?.close();
      setEditor(null);
      setRefresh((x) => x + 1);
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Salvataggio non completato.",
      );
    } finally {
      setBusy(false);
    }
  }
  const scoped = costs.filter((c) => !project || c.projectId === project),
    shown = scoped.filter((c) => filter === "Tutti" || c.status === filter);
  const summary = costSummary(scoped);
  const selectedProjects = projects.filter((p) => !project || p.id === project);
  const balances = selectedProjects.map((p) =>
    projectBalance(p.id, ledger, today()),
  );
  const revenue = balances.reduce((s, b) => s + b.confirmed, 0),
    received = balances.reduce((s, b) => s + b.received, 0);
  return (
    <section>
      <div className="agenda-heading">
        <p>
          Spese previste, impegni da pagare e uscite effettuate, collegate ai
          progetti. Margine stimato e saldo di cassa sono indicatori interni,
          prima di imposte e costi generali non registrati.
        </p>
        <button
          className="button"
          disabled={loading || !!error}
          onClick={() => open()}
        >
          + Nuovo costo
        </button>
      </div>
      <div className="project-toolbar">
        <label>
          <span className="sr-only">Progetto</span>
          <select
            aria-label="Filtra progetto"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">Tutti i progetti</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.artist}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Stato costo</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["Tutti", ...costStates].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          disabled={loading}
          onClick={() => setRefresh((x) => x + 1)}
        >
          Aggiorna
        </button>
      </div>
      <p role="status">{error}</p>
      <div className="finance-stats">
        {[
          ["Costi previsti complessivi", summary.planned],
          ["Uscite pagate", summary.paid],
          ["Margine stimato · confermati", revenue - summary.planned],
          ["Saldo incassi − uscite", received - summary.paid],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>{loading || error ? "—" : euro(Number(value))}</strong>
          </div>
        ))}
      </div>
      <p className="small">
        Il margine considera tutti i costi non annullati e solo i preventivi
        confermati. Il saldo considera incassi e costi pagati. Il filtro di
        stato agisce sull’elenco, non sui totali.
      </p>
      <section className="card">
        <h2>Pagamenti ai fornitori</h2>
        {scoped
          .filter((c) => c.status === "Da pagare")
          .sort((a, b) =>
            (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
          )
          .map((c) => (
            <div className="deadline-row" key={c.id}>
              <button className="text-button" onClick={() => open(c)}>
                {c.supplier || c.description} ·{" "}
                {projects.find((p) => p.id === c.projectId)?.title}
              </button>
              <span
                className={c.dueDate && c.dueDate < today() ? "danger" : ""}
              >
                {c.dueDate
                  ? new Date(c.dueDate + "T12:00:00Z").toLocaleDateString(
                      "it-IT",
                    )
                  : "Data da definire"}{" "}
                · {euro(c.amount)}
              </span>
            </div>
          ))}
        {!scoped.some((c) => c.status === "Da pagare") ? (
          <p>Nessun costo da pagare registrato.</p>
        ) : null}
      </section>
      <div className="project-grid section-heading">
        {shown.map((c) => (
          <article className="project-card" key={c.id}>
            <div className="list-heading">
              <span className="badge">{c.category}</span>
              <span className="status-pill">{c.status}</span>
            </div>
            <h2>{c.description}</h2>
            <p className="project-artist">
              {c.supplier || "Fornitore da indicare"}
            </p>
            <strong className="cost-amount">{euro(c.amount)}</strong>
            <p className="small">
              {projects.find((p) => p.id === c.projectId)?.title}
            </p>
            <div className="project-card-footer">
              <span>
                {c.paidDate
                  ? "Pagato il " +
                    new Date(c.paidDate + "T12:00:00Z").toLocaleDateString(
                      "it-IT",
                    )
                  : c.dueDate
                    ? "Scadenza " +
                      new Date(c.dueDate + "T12:00:00Z").toLocaleDateString(
                        "it-IT",
                      )
                    : "Scadenza da definire"}
              </span>
              <button
                className="text-button"
                disabled={loading || !!error}
                onClick={() => open(c)}
              >
                Apri costo ↗
              </button>
            </div>
          </article>
        ))}
      </div>
      {!shown.length ? <p>Nessun costo in questa vista.</p> : null}
      <section className="card">
        <h2>Confronto per progetto</h2>
        {selectedProjects.map((p) => {
          const b = projectBalance(p.id, ledger, today()),
            s = costSummary(costs.filter((c) => c.projectId === p.id));
          return (
            <div className="ledger-row" key={p.id}>
              <div>
                <Link
                  className="text-button"
                  href={"/guadagni?project=" + p.id}
                >
                  {p.title} · {p.artist}
                </Link>
                <p>
                  Confermato {euro(b.confirmed)} · costi {euro(s.planned)} ·
                  incassato {euro(b.received)}
                </p>
              </div>
              <strong>Margine {euro(b.confirmed - s.planned)}</strong>
            </div>
          );
        })}
      </section>
      <div className="dialog-actions section-heading">
        <Link className="button" href="/guadagni">
          Incassi e preventivi ↗
        </Link>
        <a className="secondary" href="/api/export">
          Esporta dati dello studio
        </a>
      </div>
      <dialog
        ref={dialog}
        className="event-dialog"
        aria-labelledby="cost-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="dialog-heading">
            <h2 id="cost-title">
              {editor === "new" ? "Nuovo costo" : "Scheda costo"}
            </h2>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
          <fieldset disabled={busy}>
            <label>
              Progetto
              <select
                required
                disabled={editor !== "new"}
                value={draft.projectId}
                onChange={(e) =>
                  setDraft({ ...draft, projectId: e.target.value })
                }
              >
                <option value="">Seleziona progetto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.artist}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Descrizione
              <input
                autoFocus
                required
                maxLength={300}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label>
              Fornitore / collaboratore
              <input
                maxLength={200}
                value={draft.supplier}
                onChange={(e) =>
                  setDraft({ ...draft, supplier: e.target.value })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                Categoria
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                >
                  {costCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Importo (€)
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            </div>
            <label>
              Stato
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    status: e.target.value,
                    paidDate: e.target.value === "Pagato" ? today() : null,
                  })
                }
              >
                {costStates.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Scadenza
                <input
                  type="date"
                  value={draft.dueDate ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, dueDate: e.target.value || null })
                  }
                />
              </label>
              {draft.status === "Pagato" ? (
                <label>
                  Pagato il
                  <input
                    type="date"
                    required
                    max={today()}
                    value={draft.paidDate ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, paidDate: e.target.value || null })
                    }
                  />
                </label>
              ) : null}
            </div>
            <label>
              Note
              <textarea
                maxLength={5000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <p className="small">
              Per ritirare una registrazione, usa Annullato. Le versioni
              precedenti restano nella cronologia.
            </p>
          </fieldset>
          <p role="status">{formError}</p>
          <button className="button" disabled={busy}>
            {busy ? "Salvataggio…" : "Salva costo"}
          </button>
        </form>
        {editor && editor !== "new" ? (
          <details className="history-panel">
            <summary>Cronologia · {history.length} versioni</summary>
            <p role="status">{historyError}</p>
            {history.map((h) => (
              <div key={h.version}>
                <p>
                  v{h.version} · {h.snapshot.status} · {euro(h.snapshot.amount)}{" "}
                  ·{" "}
                  {new Date(h.recordedAt).toLocaleString("it-IT", {
                    timeZone: "Europe/Rome",
                  })}
                </p>
                <p className="small preserve-lines">
                  {h.snapshot.description} · {h.snapshot.supplier}
                  {h.snapshot.notes}
                </p>
              </div>
            ))}
          </details>
        ) : null}
      </dialog>
    </section>
  );
}
