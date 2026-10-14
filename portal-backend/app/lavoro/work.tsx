"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  templates,
  workCategories,
  todayRome,
  duration,
  dueGroup,
  type Hour,
  type HourDraft,
  type Delivery,
} from "@/lib/work-data";
import { type StudioProject } from "@/lib/project-data";
import { type StudioTask } from "@/lib/task-data";
import { productionSpecs, type ProductionItem } from "@/lib/production-data";
import { projectBalance, euro, type Ledger } from "@/lib/finance-data";
import type { StudioCost } from "@/lib/cost-data";
type Plan = {
  projectId: string;
  template: string | null;
  plannedMinutes: number;
  version: number;
};
type Data = {
  hours: Hour[];
  delivery: Delivery[];
  plans: Plan[];
  selfEmail: string;
  admin: boolean;
  canEdit: boolean;
};
const emptyData: Data = {
  hours: [],
  delivery: [],
  plans: [],
  selfEmail: "",
  admin: false,
  canEdit: false,
};
const tabs = [
  "Il mio lavoro",
  "Urgenze",
  "Ore lavorate",
  "Modelli",
  "Consegne",
];
export default function Work() {
  const [data, setData] = useState<Data>(emptyData),
    [projects, setProjects] = useState<StudioProject[]>([]),
    [tasks, setTasks] = useState<StudioTask[]>([]),
    [items, setItems] = useState<ProductionItem[]>([]),
    [people, setPeople] = useState<{ email: string; name: string }[]>([]),
    [ledger, setLedger] = useState<Ledger | null>(null),
    [costs, setCosts] = useState<StudioCost[]>([]),
    [financeError, setFinanceError] = useState("");
  const [backups, setBackups] = useState<
      { pathname: string; bytes: number; createdAt: string }[]
    >([]),
    [backupError, setBackupError] = useState("");
  const [project, setProject] = useState(""),
    [tab, setTab] = useState(tabs[0]),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [model, setModel] = useState("Singolo"),
    [trackCount, setTrackCount] = useState(1),
    [planned, setPlanned] = useState("0"),
    [planVersion, setPlanVersion] = useState(0),
    [templatePerson, setTemplatePerson] = useState("");
  const [editor, setEditor] = useState<{
      type: "hours" | "delivery";
      record?: Hour | Delivery;
    } | null>(null),
    [id, setId] = useState(""),
    [formError, setFormError] = useState(""),
    [person, setPerson] = useState(""),
    [hour, setHour] = useState<HourDraft>({
      projectId: "",
      productionId: null,
      workedOn: todayRome(),
      minutes: 60,
      category: "Registrazione",
      description: "",
    }),
    [check, setCheck] = useState<Omit<Delivery, "id" | "version">>({
      projectId: "",
      trackId: null,
      label: "",
      done: false,
      required: true,
      assigneeEmail: null,
      dueDate: null,
      notes: "",
    }),
    [history, setHistory] = useState<
      {
        version: number;
        actor: string;
        recordedAt: string;
        snapshot: Record<string, any>;
      }[]
    >([]);
  const dialog = useRef<HTMLDialogElement>(null),
    initial = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    async function read(url: string) {
      const r = await fetch(url, { cache: "no-store", signal: c.signal });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    }
    Promise.all(
      [
        "/api/workflow",
        "/api/projects",
        "/api/tasks",
        "/api/production",
        "/api/team",
      ].map(read),
    )
      .then(async ([w, p, t, i, a]) => {
        setData(w);
        setProjects(p.projects);
        setTasks(t.tasks);
        setItems(i.items);
        setPeople(a.people);
        setError("");
        if (!initial.current) {
          initial.current = true;
          const q = new URLSearchParams(window.location.search);
          const pid = q.get("project") ?? "";
          setProject(pid);
          const plan = w.plans.find((x: Plan) => x.projectId === pid);
          setPlanned(String((plan?.plannedMinutes ?? 0) / 60));
          setPlanVersion(plan?.version ?? 0);
          const tt = q.get("tab");
          if (tt && tabs.includes(tt)) setTab(tt);
        }
        if (w.admin) {
          try {
            const [l, cost] = await Promise.all([
              read("/api/finance"),
              read("/api/costs"),
            ]);
            setLedger(l);
            setCosts(cost.costs);
            setFinanceError("");
            try {
              const b = await read("/api/backups");
              setBackups(b.files);
              setBackupError("");
            } catch (e) {
              if (!c.signal.aborted)
                setBackupError(
                  e instanceof Error ? e.message : "Backup non disponibili.",
                );
            }
          } catch (e) {
            if (!c.signal.aborted)
              setFinanceError(
                e instanceof Error
                  ? e.message
                  : "Scadenze economiche non disponibili.",
              );
          }
        } else {
          setLedger(null);
          setCosts([]);
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
    const focus = () => {
      if (document.visibilityState === "visible") setRefresh((x) => x + 1);
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, []);
  useEffect(() => {
    setHistory([]);
    if (editor && !dialog.current?.open) dialog.current?.showModal();
    if (!editor?.record) return;
    const c = new AbortController();
    fetch("/api/workflow?history=" + editor.record.id, {
      signal: c.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setHistory(d.history);
      })
      .catch((e) => {
        if (!c.signal.aborted) setFormError(e.message);
      });
    return () => c.abort();
  }, [editor]);
  function chooseProject(pid: string) {
    setProject(pid);
    const plan = data.plans.find((p) => p.projectId === pid);
    setPlanned(String((plan?.plannedMinutes ?? 0) / 60));
    setPlanVersion(plan?.version ?? 0);
  }
  function open(type: "hours" | "delivery", record?: Hour | Delivery) {
    setEditor({ type, record });
    setId(record?.id ?? crypto.randomUUID());
    setFormError("");
    if (type === "hours") {
      const r = record as Hour | undefined;
      setHour(
        r
          ? { ...r }
          : {
              projectId: project,
              productionId: null,
              workedOn: todayRome(),
              minutes: 60,
              category: "Registrazione",
              description: "",
            },
      );
      setPerson(r?.personEmail ?? data.selfEmail);
    } else {
      setCheck(
        record
          ? { ...(record as Delivery) }
          : {
              projectId: project,
              trackId: null,
              label: "",
              done: false,
              required: true,
              assigneeEmail: null,
              dueDate: null,
              notes: "",
            },
      );
    }
  }
  function close() {
    if (!busy) {
      dialog.current?.close();
      setEditor(null);
    }
  }
  async function submit(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRefresh((x) => x + 1);
      setMessage("Organizzazione del lavoro aggiornata.");
      return true;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Salvataggio non completato.";
      setError(msg);
      setFormError(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setFormError("");
    const ok = await submit(
      editor?.type === "hours"
        ? {
            action: "hours",
            id,
            projectId: hour.projectId,
            version: editor.record?.version,
            draft: hour,
            personEmail: person,
          }
        : {
            action: "delivery",
            id,
            projectId: check.projectId,
            version: editor?.record?.version,
            draft: check,
          },
    );
    if (ok) {
      dialog.current?.close();
      setEditor(null);
    }
  }
  const name = (email: string | null) =>
    people.find((p) => p.email === email)?.name ?? email ?? "Da assegnare";
  const activeProject = (pid: string) =>
    !["Completato", "Archiviato"].includes(
      projects.find((p) => p.id === pid)?.status ?? "",
    );
  const inScope = (pid: string) => !project || pid === project;
  const pName = (pid: string) =>
    projects.find((p) => p.id === pid)?.title ?? "Progetto";
  const closedItem = (i: ProductionItem) =>
    [
      "Consegnato",
      "Approvata",
      "Realizzato",
      "Registrata",
      "Archiviato",
      "Archiviata",
    ].includes(i.status);
  const work = [
    ...tasks
      .filter(
        (t) =>
          inScope(t.projectId) &&
          activeProject(t.projectId) &&
          t.status !== "Completata",
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        email: t.assigneeEmail,
        status: t.status,
        deadline: t.deadline,
        href: "/attivita?project=" + t.projectId,
        type: "Attività",
      })),
    ...items
      .filter(
        (i) =>
          inScope(i.projectId) && activeProject(i.projectId) && !closedItem(i),
      )
      .map((i) => ({
        id: i.id,
        title: i.title,
        projectId: i.projectId,
        email: i.assigneeEmail,
        status: i.status,
        deadline: i.deadline,
        href: "/produzione?project=" + i.projectId + "&kind=" + i.kind,
        type: productionSpecs[i.kind].singular,
      })),
    ...data.delivery
      .filter(
        (c) => inScope(c.projectId) && activeProject(c.projectId) && !c.done,
      )
      .map((c) => ({
        id: c.id,
        title: c.label,
        projectId: c.projectId,
        email: c.assigneeEmail,
        status: c.required ? "Verifica obbligatoria" : "Verifica",
        deadline: c.dueDate,
        href: "/lavoro?project=" + c.projectId + "&tab=Consegne",
        type: "Consegna",
      })),
  ].sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
  const mine = work.filter((w) => w.email === data.selfEmail);
  const checks = data.delivery.filter((c) => inScope(c.projectId));
  const hours = data.hours.filter((h) => inScope(h.projectId));
  const minutes = hours
    .filter((h) => !h.voidReason)
    .reduce((s, h) => s + h.minutes, 0);
  const plan = data.plans.find((p) => p.projectId === project);
  const urgent = [
    ...work.filter((w) =>
      ["In ritardo", "Entro 7 giorni"].includes(
        dueGroup(w.deadline, todayRome()),
      ),
    ),
    ...projects
      .filter(
        (p) =>
          inScope(p.id) &&
          activeProject(p.id) &&
          p.deadline &&
          ["In ritardo", "Entro 7 giorni"].includes(
            dueGroup(p.deadline, todayRome()),
          ),
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        projectId: p.id,
        email: null,
        status: p.status,
        deadline: p.deadline,
        href: "/progetti?project=" + p.id,
        type: "Progetto",
      })),
  ];
  function row(w: (typeof work)[number]) {
    return (
      <Link key={w.id} className="dashboard-project" href={w.href}>
        <div>
          <span className="badge">
            {w.type} · {w.status}
          </span>
          <h3>{w.title}</h3>
          <p>
            {pName(w.projectId)} · {name(w.email ?? null)}
          </p>
        </div>
        <span
          className={
            w.deadline && w.deadline < todayRome() ? "danger small" : "small"
          }
        >
          {w.deadline
            ? new Date(w.deadline + "T12:00:00Z").toLocaleDateString("it-IT")
            : "Da pianificare"}
        </span>
      </Link>
    );
  }
  return (
    <section>
      <p>
        Assegnazioni personali, urgenze, tempo dedicato ai progetti e controlli
        prima della consegna. Ogni voce resta collegata al lavoro dello studio.
      </p>
      <div
        className="production-tabs"
        role="group"
        aria-label="Organizzazione del lavoro"
      >
        {tabs.map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="project-toolbar">
        <label>
          <span className="sr-only">Filtro progetto</span>
          <select
            aria-label="Filtro progetto"
            style={{ width: "100%" }}
            value={project}
            onChange={(e) => chooseProject(e.target.value)}
          >
            <option value="">Tutti i progetti</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.artist}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          disabled={loading || busy}
          onClick={() => setRefresh((x) => x + 1)}
        >
          Aggiorna
        </button>
      </div>
      <p role="status">{error || message}</p>
      {tab === "Il mio lavoro" ? (
        <>
          <div className="artist-counts">
            <div>
              <strong>{mine.length}</strong>
              <span>Lavori aperti assegnati a te</span>
            </div>
            <div>
              <strong>
                {
                  mine.filter((w) => w.deadline && w.deadline < todayRome())
                    .length
                }
              </strong>
              <span>In ritardo</span>
            </div>
            <div>
              <strong>
                {duration(
                  hours
                    .filter(
                      (h) => !h.voidReason && h.personEmail === data.selfEmail,
                    )
                    .reduce((s, h) => s + h.minutes, 0),
                )}
              </strong>
              <span>Ore personali nella vista</span>
            </div>
          </div>
          <section className="card">
            <h2>Il tuo prossimo passo</h2>
            {mine.map(row)}
            {!mine.length ? (
              <p>
                {loading
                  ? "Caricamento…"
                  : "Nessun lavoro aperto collegato al tuo account."}
              </p>
            ) : null}
            <p className="small">
              Le assegnazioni solo testuali non sono associate automaticamente a
              un account. Collegale dalle schede Attività o Produzione.
            </p>
          </section>
        </>
      ) : null}
      {tab === "Urgenze" ? (
        <>
          {["In ritardo", "Entro 7 giorni"].map((group) => (
            <section className="card" key={group}>
              <h2>{group}</h2>
              {urgent
                .filter((w) => dueGroup(w.deadline, todayRome()) === group)
                .map(row)}
              {!urgent.some(
                (w) => dueGroup(w.deadline, todayRome()) === group,
              ) ? (
                <p>Nessuna scadenza in questa categoria.</p>
              ) : null}
            </section>
          ))}
          <section className="card">
            <h2>Revisioni in attesa</h2>
            {work
              .filter(
                (w) =>
                  w.type === "Revisione" &&
                  ["Da valutare", "Da approvare"].includes(w.status),
              )
              .map(row)}
            {!work.some(
              (w) =>
                w.type === "Revisione" &&
                ["Da valutare", "Da approvare"].includes(w.status),
            ) ? (
              <p>Nessuna revisione in attesa.</p>
            ) : null}
          </section>
          <section className="card">
            <h2>Da assegnare o pianificare</h2>
            {work
              .filter((w) => !w.email || !w.deadline)
              .slice(0, 20)
              .map(row)}
            <p className="small">
              Prime 20 voci aperte senza account assegnato o scadenza.
            </p>
          </section>
          {data.admin ? (
            <section className="card">
              <h2>Scadenze economiche · riservate</h2>
              <p role="status">{financeError}</p>
              {ledger
                ? projects
                    .filter((p) => inScope(p.id))
                    .flatMap((p) =>
                      projectBalance(p.id, ledger, todayRome())
                        .dues.filter(
                          (d) =>
                            d.remaining > 0 &&
                            ledger.quotes.find((q) => q.projectId === p.id)
                              ?.status === "Confermato" &&
                            ["In ritardo", "Entro 7 giorni"].includes(
                              dueGroup(d.dueDate, todayRome()),
                            ),
                        )
                        .map((d) => (
                          <div className="deadline-row" key={d.id}>
                            <Link href={"/guadagni?project=" + p.id}>
                              {p.title} · {d.label}
                            </Link>
                            <span
                              className={
                                d.dueDate < todayRome() ? "danger" : ""
                              }
                            >
                              {d.dueDate} · {euro(d.remaining)}
                            </span>
                          </div>
                        )),
                    )
                : null}
              {costs
                .filter(
                  (c) =>
                    inScope(c.projectId) &&
                    c.status === "Da pagare" &&
                    ["In ritardo", "Entro 7 giorni"].includes(
                      dueGroup(c.dueDate, todayRome()),
                    ),
                )
                .map((c) => (
                  <div className="deadline-row" key={c.id}>
                    <Link href={"/costi?project=" + c.projectId}>
                      {c.supplier || c.description}
                    </Link>
                    <span
                      className={
                        c.dueDate && c.dueDate < todayRome() ? "danger" : ""
                      }
                    >
                      {c.dueDate} · {euro(c.amount)}
                    </span>
                  </div>
                ))}
            </section>
          ) : null}
        </>
      ) : null}
      {tab === "Ore lavorate" ? (
        <>
          <div className="agenda-heading">
            <p>
              Tempo effettivamente dedicato ai progetti, registrato in minuti.
              Le ore non generano fatture o costi automaticamente.
            </p>
            <button
              className="button"
              disabled={!data.canEdit || loading || busy}
              onClick={() => open("hours")}
            >
              + Registra ore
            </button>
          </div>
          <div className="artist-counts">
            <div>
              <strong>{duration(minutes)}</strong>
              <span>Ore effettive del team</span>
            </div>
            <div>
              <strong>
                {project ? duration(plan?.plannedMinutes ?? 0) : "—"}
              </strong>
              <span>Stima del progetto</span>
            </div>
            <div>
              <strong>
                {project && plan?.plannedMinutes
                  ? duration(minutes - plan.plannedMinutes)
                  : "—"}
              </strong>
              <span>Scostamento dalla stima</span>
            </div>
          </div>
          {data.admin && ledger && project ? (
            <p className="small">
              Preventivo{" "}
              {euro(
                ledger.quotes.find((q) => q.projectId === project)?.amount ?? 0,
              )}{" "}
              · rapporto importo / ore registrate{" "}
              {minutes
                ? euro(
                    Math.round(
                      ((ledger.quotes.find((q) => q.projectId === project)
                        ?.amount ?? 0) *
                        60) /
                        minutes,
                    ),
                  ) + "/h"
                : "da calcolare"}{" "}
              (valore indicativo, non tariffa o margine).
            </p>
          ) : null}
          <section className="card">
            <h2>Tempo per progetto</h2>
            {projects
              .filter((p) => inScope(p.id))
              .map((p) => (
                <div className="deadline-row" key={p.id}>
                  <span>{p.title}</span>
                  <span>
                    {duration(
                      data.hours
                        .filter((h) => h.projectId === p.id && !h.voidReason)
                        .reduce((s, h) => s + h.minutes, 0),
                    )}
                  </span>
                </div>
              ))}
          </section>
          <section className="card">
            <h2>Registro delle ore</h2>
            {hours.map((h) => (
              <div className="ledger-row" key={h.id}>
                <div>
                  <strong>
                    {duration(h.minutes)} · {h.workedOn} · {h.category}
                  </strong>
                  <p>
                    {pName(h.projectId)} · {name(h.personEmail)}
                  </p>
                  <p className="preserve-lines">{h.description}</p>
                  {h.voidReason ? (
                    <p className="danger">Annullato: {h.voidReason}</p>
                  ) : null}
                </div>
                <button
                  className="text-button"
                  onClick={() => open("hours", h)}
                >
                  {data.canEdit &&
                  (data.admin || h.personEmail === data.selfEmail) &&
                  !h.voidReason
                    ? "Modifica"
                    : "Consulta"}{" "}
                  ↗
                </button>
              </div>
            ))}
          </section>
        </>
      ) : null}
      {data.admin && tab === "Consegne" ? (
        <section className="card">
          <div className="list-heading">
            <h2>Backup privati</h2>
            <button
              className="secondary"
              disabled={busy || loading}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch("/api/backups", { method: "POST" });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setMessage("Backup salvato e verificato tramite rilettura.");
                  setRefresh((x) => x + 1);
                } catch (e) {
                  setBackupError(
                    e instanceof Error ? e.message : "Backup non completato.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Crea backup adesso
            </button>
          </div>
          <p className="small">
            Backup automatici predisposti, in attesa di autorizzazione al trasferimento su Vercel Blob privato. Copie
            conservate nello spazio privato dello studio, senza cancellazione
            automatica. Sono esclusi credenziali Google, eventi Calendar e file
            esterni.
          </p>
          <p role="status">{backupError}</p>
          {backups.slice(0, 20).map((b) => (
            <div className="deadline-row" key={b.pathname}>
              <a
                className="text-button"
                href={"/api/backups?download=" + encodeURIComponent(b.pathname)}
              >
                {new Date(b.createdAt).toLocaleString("it-IT", {
                  timeZone: "Europe/Rome",
                })}
              </a>
              <span>{Math.ceil(b.bytes / 1024)} KB</span>
            </div>
          ))}
          {!backups.length && !backupError ? (
            <p>Nessuna copia disponibile.</p>
          ) : null}
        </section>
      ) : null}
      {tab === "Modelli" ? (
        <section className="card">
          <h2>Un punto di partenza per ogni progetto</h2>
          <p>
            Seleziona un progetto per applicare un modello una sola volta. Le
            schede già presenti vengono conservate; brani e show vengono creati
            soltanto se non ne esistono.
          </p>
          <fieldset disabled={!data.canEdit || busy || loading}>
            <div className="form-grid">
              <label>
                Modello
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {Object.keys(templates).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Numero brani
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={trackCount}
                  onChange={(e) => setTrackCount(Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Responsabile iniziale
              <select
                value={templatePerson}
                onChange={(e) => setTemplatePerson(e.target.value)}
              >
                <option value="">Da assegnare</option>
                {people.map((p) => (
                  <option key={p.email} value={p.email}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stima ore del progetto
              <input
                type="number"
                min={0}
                max={10000}
                step="0.25"
                value={planned}
                onChange={(e) => setPlanned(e.target.value)}
              />
            </label>
            <p className="small">
              Modello applicato: {plan?.template ?? "nessuno"}
            </p>
            <div className="dialog-actions">
              <button
                className="button"
                disabled={!project || !!plan?.template}
                onClick={() =>
                  void submit({
                    action: "template",
                    projectId: project,
                    version: planVersion,
                    template: model,
                    trackCount,
                    plannedMinutes: Math.round(Number(planned) * 60),
                    assigneeEmail: templatePerson || null,
                  }).then((ok) => {
                    if (ok) setPlanVersion((v) => v + 1);
                  })
                }
              >
                Applica modello
              </button>
              <button
                className="secondary"
                disabled={!project}
                onClick={() =>
                  void submit({
                    action: "plan",
                    projectId: project,
                    version: planVersion,
                    plannedMinutes: Math.round(Number(planned) * 60),
                  }).then((ok) => {
                    if (ok) setPlanVersion((v) => v + 1);
                  })
                }
              >
                Salva stima ore
              </button>
            </div>
          </fieldset>
          <h3>Il modello comprende</h3>
          <ul>
            {templates[model as keyof typeof templates].tasks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h3>Controlli di consegna</h3>
          <ul>
            {templates[model as keyof typeof templates].checks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {tab === "Consegne" ? (
        <>
          <div className="agenda-heading">
            <p>
              Controlli prima di chiudere il progetto o consegnare un brano. Le
              verifiche obbligatorie aperte bloccano la chiusura.
            </p>
            <button
              className="button"
              disabled={!data.canEdit || loading || busy}
              onClick={() => open("delivery")}
            >
              + Verifica
            </button>
          </div>
          <section className="card">
            <h2>
              {checks.filter((c) => c.done).length} / {checks.length} verifiche
              completate
            </h2>
            {checks.map((c) => (
              <div className="ledger-row" key={c.id}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={c.done}
                    disabled={
                      !data.canEdit ||
                      busy ||
                      loading ||
                      projects.find((p) => p.id === c.projectId)?.status ===
                        "Archiviato"
                    }
                    onChange={(e) => {
                      const done = e.target.checked;
                      setData((old) => ({
                        ...old,
                        delivery: old.delivery.map((x) =>
                          x.id === c.id ? { ...x, done } : x,
                        ),
                      }));
                      void submit({
                        action: "delivery",
                        id: c.id,
                        projectId: c.projectId,
                        version: c.version,
                        draft: { ...c, done },
                      }).then((ok) => {
                        if (!ok)
                          setData((old) => ({
                            ...old,
                            delivery: old.delivery.map((x) =>
                              x.id === c.id ? c : x,
                            ),
                          }));
                      });
                    }}
                  />
                  <span>
                    <strong>{c.label}</strong>
                    <p>
                      {pName(c.projectId)}
                      {c.trackId
                        ? " · " + items.find((i) => i.id === c.trackId)?.title
                        : ""}{" "}
                      · {c.required ? "Obbligatoria" : "Facoltativa"} ·{" "}
                      {name(c.assigneeEmail)}
                    </p>
                  </span>
                </label>
                <button
                  className="text-button"
                  onClick={() => open("delivery", c)}
                >
                  Scheda ↗
                </button>
              </div>
            ))}
            {!checks.length ? (
              <p>Aggiungi le verifiche o applica un modello al progetto.</p>
            ) : null}
          </section>
        </>
      ) : null}
      <dialog
        ref={dialog}
        className="event-dialog"
        aria-labelledby="work-title"
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
            <h2 id="work-title">
              {editor?.type === "hours"
                ? "Registro ore"
                : "Verifica di consegna"}
            </h2>
            <button
              type="button"
              disabled={busy}
              className="secondary"
              onClick={close}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
          <fieldset
            disabled={
              busy ||
              !data.canEdit ||
              (editor?.type === "hours" &&
                !!editor.record &&
                ((editor.record as Hour).voidReason !== null ||
                  (!data.admin &&
                    (editor.record as Hour).personEmail !== data.selfEmail)))
            }
          >
            <label>
              Progetto
              <select
                required
                disabled={!!editor?.record}
                value={
                  editor?.type === "hours" ? hour.projectId : check.projectId
                }
                onChange={(e) =>
                  editor?.type === "hours"
                    ? setHour({
                        ...hour,
                        projectId: e.target.value,
                        productionId: null,
                      })
                    : setCheck({
                        ...check,
                        projectId: e.target.value,
                        trackId: null,
                      })
                }
              >
                <option value="">Seleziona progetto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            {editor?.type === "hours" ? (
              <>
                <label>
                  Persona
                  <select
                    disabled={!data.admin || !!editor.record}
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                  >
                    {person && !people.some((p) => p.email === person) ? (
                      <option value={person}>{person}</option>
                    ) : null}
                    {people.map((p) => (
                      <option key={p.email} value={p.email}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Data lavoro
                    <input
                      type="date"
                      required
                      max={todayRome()}
                      value={hour.workedOn}
                      onChange={(e) =>
                        setHour({ ...hour, workedOn: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Minuti lavorati
                    <input
                      type="number"
                      required
                      min={1}
                      max={1440}
                      value={hour.minutes}
                      onChange={(e) =>
                        setHour({ ...hour, minutes: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <label>
                  Fase
                  <select
                    value={hour.category}
                    onChange={(e) =>
                      setHour({ ...hour, category: e.target.value })
                    }
                  >
                    {workCategories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Scheda produttiva
                  <select
                    value={hour.productionId ?? ""}
                    onChange={(e) =>
                      setHour({ ...hour, productionId: e.target.value || null })
                    }
                  >
                    <option value="">Lavoro generale del progetto</option>
                    {items
                      .filter((i) => i.projectId === hour.projectId)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Lavoro svolto
                  <textarea
                    required
                    maxLength={3000}
                    value={hour.description}
                    onChange={(e) =>
                      setHour({ ...hour, description: e.target.value })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Verifica
                  <input
                    required
                    maxLength={300}
                    value={check.label}
                    onChange={(e) =>
                      setCheck({ ...check, label: e.target.value })
                    }
                  />
                </label>
                <label>
                  Brano
                  <select
                    disabled={!!editor?.record}
                    value={check.trackId ?? ""}
                    onChange={(e) =>
                      setCheck({ ...check, trackId: e.target.value || null })
                    }
                  >
                    <option value="">Intero progetto</option>
                    {items
                      .filter(
                        (i) =>
                          i.kind === "track" && i.projectId === check.projectId,
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Responsabile
                  <select
                    value={check.assigneeEmail ?? ""}
                    onChange={(e) =>
                      setCheck({
                        ...check,
                        assigneeEmail: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Da assegnare</option>
                    {check.assigneeEmail &&
                    !people.some((p) => p.email === check.assigneeEmail) ? (
                      <option value={check.assigneeEmail}>
                        {check.assigneeEmail} · non attivo
                      </option>
                    ) : null}
                    {people.map((p) => (
                      <option key={p.email} value={p.email}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Scadenza
                  <input
                    type="date"
                    value={check.dueDate ?? ""}
                    onChange={(e) =>
                      setCheck({ ...check, dueDate: e.target.value || null })
                    }
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={check.required}
                    disabled={!data.admin}
                    onChange={(e) =>
                      setCheck({ ...check, required: e.target.checked })
                    }
                  />
                  Obbligatoria
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={check.done}
                    onChange={(e) =>
                      setCheck({ ...check, done: e.target.checked })
                    }
                  />
                  Completata
                </label>
                <label>
                  Note
                  <textarea
                    maxLength={5000}
                    value={check.notes}
                    onChange={(e) =>
                      setCheck({ ...check, notes: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            <button className="button" disabled={busy}>
              Salva
            </button>
            {editor?.type === "hours" &&
            editor.record &&
            !(editor.record as Hour).voidReason ? (
              <button
                type="button"
                className="text-button danger"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt(
                    "Motivo dell’annullamento delle ore:",
                  );
                  if (reason)
                    void submit({
                      action: "voidHours",
                      projectId: hour.projectId,
                      id,
                      version: editor.record?.version,
                      reason,
                    }).then((ok) => {
                      if (ok) {
                        dialog.current?.close();
                        setEditor(null);
                      }
                    });
                }}
              >
                Annulla registrazione
              </button>
            ) : null}
          </fieldset>
          <p role="status">{formError}</p>
        </form>
        {editor?.record ? (
          <details className="history-panel">
            <summary>Cronologia · {history.length} versioni</summary>
            {history.map((h) => (
              <p key={h.version}>
                v{h.version} · {name(h.actor)} ·{" "}
                {new Date(h.recordedAt).toLocaleString("it-IT", {
                  timeZone: "Europe/Rome",
                })}
                <br />
                {h.snapshot.description ??
                  h.snapshot.label ??
                  h.snapshot.voidReason ??
                  ""}
                {h.snapshot.minutes ? " · " + duration(h.snapshot.minutes) : ""}
                {typeof h.snapshot.done === "boolean"
                  ? " · " + (h.snapshot.done ? "Completata" : "Aperta")
                  : ""}
              </p>
            ))}
          </details>
        ) : null}
      </dialog>
    </section>
  );
}
