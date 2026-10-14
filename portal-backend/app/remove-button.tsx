"use client";
import { useState } from "react";
export default function RemoveButton({
  kind,
  id,
  version,
  title,
  onRemoved,
}: {
  kind: string;
  id: string;
  version: number;
  title: string;
  onRemoved: () => void;
}) {
  const [confirm, setConfirm] = useState(false),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          kind,
          id,
          version,
          confirmation: text,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eliminazione non completata.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="remove-resource">
      {!confirm ? (
        <button
          type="button"
          className="text-button danger"
          onClick={() => setConfirm(true)}
        >
          Elimina{" "}
          {kind === "project"
            ? "progetto"
            : kind === "production"
              ? "scheda"
              : kind === "artist"
                ? "artista"
                : "attività"}
        </button>
      ) : (
        <div className="delete-confirm">
          <strong>Spostare «{title}» nel cestino?</strong>
          <p>
            {kind === "project"
              ? "Anche i suoi brani e attività saranno nascosti dalle viste operative. "
              : ""}
            I dati economici e lo storico restano conservati. Puoi ripristinare
            dal Cestino.
          </p>
          <label>
            Scrivi il titolo per confermare
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="secondary danger"
            disabled={busy || text !== title}
            onClick={() => void remove()}
          >
            {busy ? "Eliminazione…" : "Conferma eliminazione"}
          </button>{" "}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Annulla
          </button>
          <p role="status">{error}</p>
        </div>
      )}
    </div>
  );
}
