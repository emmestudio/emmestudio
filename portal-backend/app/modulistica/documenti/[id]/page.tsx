import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { ownerSession } from "@/lib/owner-session";
import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";
import PrintButton from "@/app/preventivi/[id]/print-button";
import FormPaper from "../../form-paper";
import PublishDocument from "../../publish-document";
import "../../modulistica.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documento — Emme Studio / Emme Label" };

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const session = await ownerSession(await headers());
  if (!session) redirect("/accesso");
  const { id } = await params;
  if (!validId(id)) notFound();
  const db = getDb();
  const doc = (await db.query("SELECT * FROM studio_form_documents WHERE id=$1 AND owner_id=$2",
    [id, session.user.id])).rows[0];
  if (!doc) notFound();
  const latest = doc.version;
  const requested = (await searchParams).version;
  if (requested) {
    const version = Number(requested);
    if (!/^\d+$/.test(requested) || !Number.isSafeInteger(version) || version < 1 || version > latest) notFound();
    const old = (await db.query("SELECT payload,state,version FROM studio_form_history WHERE document_id=$1 AND version=$2",
      [id, version])).rows[0];
    if (!old) notFound();
    Object.assign(doc, old);
  }
  const history = (await db.query(
    `SELECT h.version,h.state,h.recorded_at,s.id AS "shareId",s.returned_at AS "returnedAt",o.state AS "emailState"
     FROM studio_form_history h
     LEFT JOIN studio_artist_form_shares s ON s.document_id=h.document_id AND s.version=h.version
     LEFT JOIN studio_artist_email_outbox o ON o.id=s.email_job_id
     WHERE h.document_id=$1 ORDER BY h.version DESC`, [id],
  )).rows;
  const current = history.find(item => item.version === doc.version);
  const artistId = doc.payload.draft.artistId;
  const definition = doc.payload.definition;
  return <main className="shell agreement-document">
    <div className="no-print forms-preview-actions">
      <a href={definition ? "/modulistica/modelli/" + definition.slug : "/modulistica/servizi"}>Torna ai documenti</a>
      <PrintButton/>
      {doc.state === "ready" && doc.version === latest && artistId ?
        <PublishDocument id={id} artistId={artistId} version={doc.version} emailState={current?.shareId ? current.emailState ?? "uncertain" : null}/> : null}
      <p>{definition?.signatures === "none" ? "Per questo documento non è richiesta una firma." :
        "Controlla dati e condizioni prima della sottoscrizione."}</p>
    </div>
    <FormPaper doc={doc}/>
    <details className="card no-print">
      <summary>Versioni salvate · {history.length}</summary>
      {history.map(item => <p key={item.version}>
        <a href={"/modulistica/documenti/" + id + "?version=" + item.version}>
          Versione {item.version} · {item.state === "ready" ? "Preparato" : "Bozza"} · {new Date(item.recorded_at).toLocaleString("it-IT", {timeZone:"Europe/Rome"})}
        </a>
        {item.shareId ? " · Pubblicata nell’area artista" : ""}
        {item.returnedAt ? <> · <a href={"/api/artist-documents/" + item.shareId}>Scarica copia restituita</a></> : null}
      </p>)}
    </details>
  </main>;
}
