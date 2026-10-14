"use client";
import { useState } from "react";
export default function RemoveButton({
  kind,
  id,
  version,
  title,
  onRemoved,
  permanent = false,
}: {
  kind: string;
  id: string;
  version: number;
  title: string;
  onRemoved: () => void;
  permanent?: boolean;
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
          action: permanent ? "purge" : "delete",
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
          {permanent ? "Elimina definitivamente" : "Elimina"}{" "}
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
          <strong>{permanent ? `Eliminare definitivamente «${title}»?` : `Spostare «${title}» nel cestino?`}</strong>
          <p>
            {permanent ? "Questa azione non è reversibile: elimina progetto, brani, registrazioni, materiali, revisioni, live, attività, ore, verifiche, preventivi, incassi, rate, costi e storico collegati. Il profilo artista resta conservato. File esterni ed eventi Google Calendar restano disponibili nei rispettivi servizi." : <>
            {kind === "project"
              ? "Anche i suoi brani e attività saranno nascosti dalle viste operative. "
              : ""}
            I dati economici e lo storico restano conservati. Puoi ripristinare
            dal Cestino.
            </>}
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
            {busy ? "Eliminazione…" : permanent ? "Elimina definitivamente" : "Conferma eliminazione"}
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
