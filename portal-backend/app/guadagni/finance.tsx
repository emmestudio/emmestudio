"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  euro,
  moneyInput,
  projectBalance,
  paymentMethods,
  type Ledger,
} from "@/lib/finance-data";
import { type StudioProject } from "@/lib/project-data";
const emptyLedger: Ledger = { quotes: [], installments: [], payments: [] };
const todayRome = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const dateLabel = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("it-IT", {
    timeZone: "Europe/Rome",
  });
export default function Finance() {
  const [ledger, setLedger] = useState<Ledger>(emptyLedger),
    [projects, setProjects] = useState<StudioProject[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Tutti"),
    [selected, setSelected] = useState(""),
    [artist, setArtist] = useState(""),
    [period, setPeriod] = useState("");
  const [action, setAction] = useState<
      "payment" | "due" | "void" | "removeDue" | null
    >(null),
    [projectId, setProjectId] = useState(""),
    [id, setId] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(todayRome()),
    [label, setLabel] = useState(""),
    [notes, setNotes] = useState(""),
    [method, setMethod] = useState("Bonifico"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const initial = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    Promise.all(
      ["/api/finance", "/api/projects"].map(async (url) => {
        const r = await fetch(url, { cache: "no-store", signal: c.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    )
      .then(([l, p]) => {
        setLedger(l);
        setProjects(p.projects);
        setError("");
        if (!initial.current) {
          initial.current = true;
          const q = new URLSearchParams(window.location.search);
          setSelected(q.get("project") ?? "");
          setArtist(q.get("artist") ?? "");
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
    if (action && !dialog.current?.open) dialog.current?.showModal();
  }, [action]);
  function open(a: typeof action, p: StudioProject, existingId?: string) {
    setAction(a);
    setProjectId(p.id);
    setId(existingId ?? crypto.randomUUID());
    setAmount("");
    setDate(todayRome());
    setLabel(a === "payment" ? "Incasso" : "Saldo");
    setNotes("");
    setMethod("Bonifico");
    setReason("");
    setFormError("");
  }
  function close() {
    if (!busy) {
      dialog.current?.close();
      setAction(null);
    }
  }
  async function save() {
    setBusy(true);
    setFormError("");
    try {
      const r = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          projectId,
          quoteVersion: ledger.quotes.find((q) => q.projectId === projectId)
            ?.version,
          action,
          amount:
            action === "payment" || action === "due"
              ? moneyInput(amount)
              : undefined,
          date,
          label,
          method,
          notes,
          reason,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      dialog.current?.close();
      setAction(null);
      setRefresh((x) => x + 1);
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Registrazione non completata.",
      );
    } finally {
      setBusy(false);
    }
  }
  const today = todayRome();
  const scoped = projects.filter(
    (p) =>
      (!artist || p.artistId === artist) && (!selected || p.id === selected),
  );
  const balances = scoped.map((p) => ({
    p,
    ...projectBalance(p.id, ledger, today),
  }));
  const allDues = balances
    .flatMap((b) =>
      b.quote?.status === "Confermato"
        ? b.dues.filter((d) => d.remaining > 0).map((d) => ({ ...d, p: b.p }))
        : [],
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const receipts = ledger.payments.filter(
    (p) =>
      scoped.some((x) => x.id === p.projectId) &&
      (!period || p.paidDate.startsWith(period)),
  );
  const received = receipts
    .filter((p) => !p.voidReason)
    .reduce((s, p) => s + p.amount, 0);
  const outstanding = balances.reduce((s, b) => s + b.outstanding, 0);
  const overdue = balances.reduce((s, b) => s + b.overdue, 0);
  const end = new Date(today + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 30);
  const limit = end.toISOString().slice(0, 10);
  const dueSoon = allDues
    .filter((d) => d.dueDate >= today && d.dueDate <= limit)
    .reduce((s, d) => s + d.remaining, 0);
  const shown = balances.filter(
    (b) =>
      (b.p.title + " " + b.p.artist + " " + b.p.service)
        .toLocaleLowerCase("it")
        .includes(search.toLocaleLowerCase("it")) &&
      (filter === "Tutti" ||
        (filter === "Da saldare" && b.outstanding > 0) ||
        (filter === "Saldati" && b.confirmed > 0 && b.outstanding === 0) ||
        (filter === "Preventivi aperti" &&
          !!b.quote &&
          ["Bozza", "Inviato"].includes(b.quote.status))),
  );
  return (
    <section>
      <div className="dialog-actions">
        <Link className="secondary" href="/costi">
          Costi e margini ↗
        </Link>
        <a className="secondary" href="/api/export">
          Esporta dati dello studio
        </a>
      </div>
      <p>
        Preventivi, pagamenti parziali e scadenze dei progetti. Gli incassi sono
        somme ricevute, prima di costi e imposte; il registro non sostituisce la
        contabilità fiscale.
      </p>
      <div className="project-toolbar">
        <label>
          <span className="sr-only">Cerca nel registro</span>
          <input
            type="search"
            placeholder="Cerca progetto, artista o servizio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filtro registro</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {["Tutti", "Da saldare", "Saldati", "Preventivi aperti"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
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
      {selected || artist ? (
        <p className="small">
          Vista filtrata per {selected ? "progetto" : "artista"}.{" "}
          <button
            className="text-button"
            onClick={() => {
              setSelected("");
              setArtist("");
            }}
          >
            Mostra tutto
          </button>
        </p>
      ) : null}
      <p role="status">{error}</p>
      <div className="finance-stats">
        {[
          ["Incassato" + (period ? " · " + period : ""), received],
          ["Da incassare · confermati", outstanding],
          ["Scaduto", overdue],
          ["In scadenza · 30 giorni", dueSoon],
        ].map(([title, value]) => (
          <div key={String(title)}>
            <span>{title}</span>
            <strong>{loading || error ? "—" : euro(Number(value))}</strong>
          </div>
        ))}
      </div>
      <p className="small">
        I totali seguono la vista artista/progetto. Ricerca e filtro di stato
        agiscono sull’elenco sottostante. Il mese selezionato filtra solo gli
        incassi.
      </p>
      <section className="card">
        <h2>Scadenze di pagamento</h2>
        {allDues.slice(0, 20).map((d) => (
          <div className="deadline-row" key={d.id}>
            <Link href={"/progetti?project=" + d.projectId}>
              {d.p.title} · {d.label}
            </Link>
            <span className={d.dueDate < today ? "danger" : ""}>
              {dateLabel(d.dueDate)} · {euro(d.remaining)}
            </span>
          </div>
        ))}
        {!allDues.length ? (
          <p>
            {error
              ? "Registro non disponibile."
              : "Nessuna rata da saldare con data assegnata."}
          </p>
        ) : null}
        {allDues.length > 20 ? (
          <p className="small">
            Prime 20 scadenze. Le altre sono nelle schede economiche dei
            progetti.
          </p>
        ) : null}
        {balances.some((b) => b.unscheduled > 0) ? (
          <p className="small danger">
            {euro(balances.reduce((s, b) => s + b.unscheduled, 0))} ancora da
            incassare senza una scadenza assegnata. Aggiungi le rate nelle
            schede qui sotto.
          </p>
        ) : null}
      </section>
      <h2 className="section-heading">Situazione dei progetti</h2>
      <div className="project-grid">
        {shown.map((b) => (
          <article className="project-card" key={b.p.id}>
            <div className="list-heading">
              <span className="badge">{b.p.service}</span>
              <span className="status-pill">
                {b.quote?.status ?? "Senza preventivo"}
              </span>
            </div>
            <h2>{b.p.title}</h2>
            <p className="project-artist">{b.p.artist}</p>
            <div className="finance-inline">
              <span>
                Preventivo <strong>{euro(b.quote?.amount ?? 0)}</strong>
              </span>
              <span>
                Incassato <strong>{euro(b.received)}</strong>
              </span>
              <span>
                Residuo <strong>{euro(b.outstanding)}</strong>
              </span>
            </div>
            {b.quote?.notes ? (
              <p className="small preserve-lines">{b.quote.notes}</p>
            ) : null}
            {b.quote?.status === "Confermato" ? (
              <>
                <progress
                  max={b.confirmed}
                  value={b.received}
                  aria-label={"Incassi di " + b.p.title}
                />
                <div className="dialog-actions">
                  <button
                    className="secondary"
                    disabled={loading || !!error || !b.outstanding}
                    onClick={() => open("payment", b.p)}
                  >
                    + Incasso
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      loading ||
                      !!error ||
                      b.dues.reduce((s, d) => s + d.amount, 0) >= b.confirmed
                    }
                    onClick={() => open("due", b.p)}
                  >
                    + Scadenza
                  </button>
                </div>
              </>
            ) : null}
            <details className="finance-details">
              <summary>Rate pianificate ({b.dues.length})</summary>
              {b.dues.map((d) => (
                <div className="ledger-row" key={d.id}>
                  <div>
                    <strong>
                      {d.label} · {dateLabel(d.dueDate)}
                    </strong>
                    <p>
                      {euro(d.amount)} · residuo {euro(d.remaining)}
                    </p>
                  </div>
                  <button
                    className="text-button danger"
                    disabled={loading || !!error}
                    onClick={() => open("removeDue", b.p, d.id)}
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
              <p className="small">
                Gli incassi coprono le rate in ordine di scadenza. La rimozione
                di una rata non elimina gli incassi.
              </p>
            </details>
            <Link className="text-button" href={"/progetti?project=" + b.p.id}>
              Modifica servizio e preventivo ↗
            </Link>
            {b.quote ? (
              <Link className="text-button" href={"/preventivi/" + b.p.id}>
                Preventivo · PDF e cronologia ↗
              </Link>
            ) : null}
          </article>
        ))}
      </div>
      {!shown.length ? (
        <p>
          {loading
            ? "Caricamento…"
            : "Nessun progetto corrispondente. Crea un progetto e inserisci il preventivo."}
        </p>
      ) : null}
      <section className="card">
        <div className="list-heading">
          <h2>Registro degli incassi</h2>
          <label>
            Mese
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        </div>
        {period ? (
          <button className="text-button" onClick={() => setPeriod("")}>
            Tutti i mesi
          </button>
        ) : null}
        {receipts.map((p) => (
          <div
            className={"ledger-row" + (p.voidReason ? " voided" : "")}
            key={p.id}
          >
            <div>
              <strong>
                {euro(p.amount)} · {dateLabel(p.paidDate)} · {p.method}
              </strong>
              <p>
                {projects.find((x) => x.id === p.projectId)?.title} ·{" "}
                {projects.find((x) => x.id === p.projectId)?.artist}
              </p>
              {p.notes ? <p className="preserve-lines">{p.notes}</p> : null}
              {p.voidReason ? (
                <p className="danger">Stornato: {p.voidReason}</p>
              ) : null}
            </div>
            {!p.voidReason ? (
              <button
                className="text-button danger"
                disabled={loading || !!error}
                onClick={() =>
                  open(
                    "void",
                    projects.find((x) => x.id === p.projectId)!,
                    p.id,
                  )
                }
              >
                Storna
              </button>
            ) : null}
          </div>
        ))}
        {!receipts.length ? (
          <p>Nessun incasso registrato per questa vista.</p>
        ) : null}
      </section>
      <dialog
        ref={dialog}
        className="event-dialog"
        aria-labelledby="finance-title"
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
            <h2 id="finance-title">
              {action === "payment"
                ? "Registra incasso"
                : action === "due"
                  ? "Pianifica scadenza"
                  : action === "void"
                    ? "Storna incasso"
                    : "Rimuovi scadenza"}
            </h2>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              ×
            </button>
          </div>
          <p>{projects.find((p) => p.id === projectId)?.title}</p>
          <fieldset disabled={busy}>
            {action === "payment" || action === "due" ? (
              <>
                <div className="form-grid">
                  <label>
                    Importo (€)
                    <input
                      autoFocus
                      required
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    {action === "payment" ? "Ricevuto il" : "Scadenza"}
                    <input
                      type="date"
                      required
                      max={action === "payment" ? today : undefined}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                </div>
                {action === "payment" ? (
                  <label>
                    Metodo
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      {paymentMethods.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Descrizione rata
                    <input
                      required
                      maxLength={200}
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Note
                  <textarea
                    maxLength={5000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </>
            ) : action === "void" ? (
              <>
                <p>
                  L’incasso resterà nel registro come stornato e il residuo sarà
                  ricalcolato.
                </p>
                <label>
                  Motivo dello storno
                  <textarea
                    autoFocus
                    required
                    minLength={3}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <p>
                La scadenza sarà rimossa dal piano rate. Gli incassi registrati
                restano nel registro.
              </p>
            )}
          </fieldset>
          <p role="status">{formError}</p>
          <button className="button" disabled={busy || loading || !!error}>
            {busy ? "Salvataggio…" : "Conferma registrazione"}
          </button>
        </form>
      </dialog>
    </section>
  );
}
