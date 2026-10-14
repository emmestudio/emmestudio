"use client";
import { useEffect, useState } from "react";
type Member = {
  email: string;
  name: string;
  role: "editor" | "viewer";
  active: boolean;
  version: number;
  registered: boolean;
};
export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Member | null>(null);
  const [draft, setDraft] = useState({
    email: "",
    name: "",
    role: "viewer" as "viewer" | "editor",
    active: true,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/members", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setMembers(data.members);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message);
      });
    return () => controller.abort();
  }, [refresh]);
  function reset() {
    setEditing(null);
    setDraft({ email: "", name: "", role: "viewer", active: true });
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/members", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member: draft, version: editing?.version }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      reset();
      setRefresh((value) => value + 1);
      setMessage("Accesso salvato.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Accesso non salvato.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <p>
        Questi accessi consentono di consultare tutti gli artisti, i progetti,
        le attività e il calendario dello studio. Il portale è riservato al team
        interno. Gli artisti sono profili di lavoro e non hanno accesso.
      </p>
      <div className="role-options">
        <div className="card">
          <span className="badge">CONSULTAZIONE</span>
          <h2>Seguire il lavoro.</h2>
          <p>
            Legge dashboard, artisti, progetti, produzione, attività e
            appuntamenti.
          </p>
        </div>
        <div className="card">
          <span className="badge">MODIFICA</span>
          <h2>Lavorare insieme.</h2>
          <p>
            Può anche creare e modificare artisti, progetti, schede di
            produzione, attività e appuntamenti. Preventivi, incassi e gestione
            degli accessi restano riservati all’amministratore.
          </p>
        </div>
      </div>
      <div className="card">
        <h2>{editing ? "Modifica accesso" : "Abilita un collaboratore"}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy}>
            <div className="form-grid">
              <label>
                Nome
                <input
                  required
                  maxLength={200}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label>
                Email Google
                <input
                  required
                  type="email"
                  maxLength={254}
                  disabled={Boolean(editing)}
                  value={draft.email}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Ruolo
                <select
                  value={draft.role}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      role: event.target.value as "editor" | "viewer",
                    })
                  }
                >
                  <option value="viewer">Consultazione</option>
                  <option value="editor">Modifica</option>
                </select>
              </label>
              <label>
                Accesso
                <select
                  value={draft.active ? "active" : "inactive"}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      active: event.target.value === "active",
                    })
                  }
                >
                  <option value="active">Abilitato</option>
                  <option value="inactive">Disabilitato</option>
                </select>
              </label>
            </div>
          </fieldset>
          <div className="dialog-actions">
            <button className="button" disabled={busy}>
              {busy
                ? "Salvataggio…"
                : editing
                  ? "Salva accesso"
                  : "Abilita accesso"}
            </button>
            {editing ? (
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={reset}
              >
                Annulla modifica
              </button>
            ) : null}
          </div>
        </form>
        <p className="small">
          Il collaboratore accederà con Google usando questa email. Durante la
          modalità test Google, aggiungi la stessa email agli utenti di test del
          progetto Emme Studio Portal. Per cambiare email, disabilita il vecchio
          accesso e abilita quello nuovo.
        </p>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </div>
      <div className="card">
        <div className="list-heading">
          <h2>Accessi del team</h2>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Aggiorna
          </button>
        </div>
        {members.map((member) => (
          <article className="member-row" key={member.email}>
            <div>
              <h3>{member.name}</h3>
              <p>{member.email}</p>
              <span className="small">
                {member.role === "editor" ? "Modifica" : "Consultazione"} ·{" "}
                {member.active ? "Abilitato" : "Disabilitato"} ·{" "}
                {member.registered
                  ? "Account registrato"
                  : "Primo accesso da completare"}
              </span>
            </div>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(member);
                setDraft({
                  email: member.email,
                  name: member.name,
                  role: member.role,
                  active: member.active,
                });
              }}
            >
              Gestisci
            </button>
          </article>
        ))}
        {!members.length ? <p>Gli accessi abilitati appariranno qui.</p> : null}
      </div>
    </section>
  );
}
