"use client";

import { useState } from "react";

export default function PublishDocument({ id, artistId, version, emailState }: {
  id: string;
  artistId: string;
  version: number;
  emailState: string | null;
}) {
  const [sentState, setSentState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const state = sentState ?? emailState;
  const canSend = !state || state === "failed" || state === "queued";
  async function publish() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/forms/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, artistId, version }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setSentState(data.emailState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pubblicazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    {canSend ? <button className="secondary" type="button" disabled={busy} onClick={() => void publish()}>
      {busy ? "Invio in corso…" : state ? "Riprova notifica email" : "Invia all’area artista"}
    </button> : null}
    {state ? <p className="small" role="status">
      {state === "sent" ? "Nell’area artista · Email inviata" :
        state === "failed" ? "Nell’area artista · Invio email non riuscito" :
        state === "queued" ? "Nell’area artista · Email in attesa" :
        "Nell’area artista · Verifica l’esito nel registro notifiche"}
    </p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
