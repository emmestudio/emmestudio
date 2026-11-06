import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { artistSession } from "@/lib/artist-session";
import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";
import FormPaper from "@/app/modulistica/form-paper";
import PrintButton from "@/app/preventivi/[id]/print-button";
import "@/app/modulistica/modulistica.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documento · Area artista" };

export default async function ArtistDocument({ params }: { params: Promise<{ id: string }> }) {
  const session = await artistSession(await headers());
  if (!session) redirect("/accesso?area=artista");
  const { id } = await params;
  if (!validId(id)) notFound();
  const doc = (await getDb().query(
    `SELECT d.id,d.template,h.version,h.payload,h.state
     FROM studio_artist_form_shares s
     JOIN studio_form_documents d ON d.id=s.document_id AND d.owner_id=s.owner_id
     JOIN studio_form_history h ON h.document_id=s.document_id AND h.version=s.version AND h.state='ready'
     WHERE s.id=$1 AND s.owner_id=$2 AND s.artist_id=$3`, [id, session.ownerId, session.artistId],
  )).rows[0];
  if (!doc) notFound();
  return <main className="shell agreement-document">
    <div className="no-print forms-preview-actions">
      <a href="/area-artista#modulistica">Torna alla modulistica</a>
      <PrintButton/>
    </div>
    <FormPaper doc={doc}/>
  </main>;
}
