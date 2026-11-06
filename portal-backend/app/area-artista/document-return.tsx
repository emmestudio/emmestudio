"use client";

import { useState, type FormEvent } from "react";

export default function DocumentReturn({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [returned, setReturned] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("signed");
    if (!(file instanceof File) || !file.size) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Il PDF deve pesare al massimo 4 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/artist-documents/" + id, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setReturned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio della copia non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return returned ? <p role="status">Copia restituita allo Studio. <a href={"/api/artist-documents/" + id}>Scarica copia</a></p> :
    <form onSubmit={submit}>
      <label>PDF firmato (massimo 4 MB)
        <input name="signed" type="file" accept=".pdf,application/pdf" required disabled={busy}/>
      </label>
      <button className="secondary" type="submit" disabled={busy}>{busy ? "Caricamento…" : "Invia copia firmata"}</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>;
}
