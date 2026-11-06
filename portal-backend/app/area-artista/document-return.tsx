"use client";

import { useRef, useState, type FormEvent } from "react";

import { upload } from "@vercel/blob/client";
import { directDocumentLimit, signedDocumentLimit, signedDocumentLimitMb, signedDocumentPath } from "@/lib/signed-document-upload";

export default function DocumentReturn({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [returned, setReturned] = useState(false);
  const [error, setError] = useState("");

  const pendingPath = useRef("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("signed");
    if (!(file instanceof File) || !file.size) return;
    if (file.size > signedDocumentLimit) {
      setError(`Il PDF deve pesare al massimo ${signedDocumentLimitMb} MB.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const endpoint = "/api/artist-documents/" + id;
      const large = file.size > directDocumentLimit;
      if (large && !pendingPath.current) {
        const stored = await upload(signedDocumentPath(id, crypto.randomUUID()), file, {
          access: "private",
          contentType: "application/pdf",
          handleUploadUrl: endpoint + "/upload",
          multipart: true,
        });
        pendingPath.current = stored.pathname;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": large ? "application/json" : "application/pdf" },
        body: large ? JSON.stringify({ pathname: pendingPath.current }) : file,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) pendingPath.current = "";
        throw Error(result.error);
      }
      setReturned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invio della copia non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return returned ? <p role="status">Copia restituita allo Studio. <a href={"/api/artist-documents/" + id}>Scarica copia</a></p> :
    <form onSubmit={submit}>
      <label>PDF firmato (massimo {signedDocumentLimitMb} MB)
        <input name="signed" type="file" accept=".pdf,application/pdf" required disabled={busy} onChange={() => { pendingPath.current = ""; setError(""); }}/>
      </label>
      <button className="secondary" type="submit" disabled={busy}>{busy ? "Caricamento…" : "Invia copia firmata"}</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>;
}
