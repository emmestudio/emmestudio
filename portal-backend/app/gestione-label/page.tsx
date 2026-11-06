import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerSession } from "@/lib/owner-session";
import Editor from "./editor";
import "../redazione/redazione.css";

export const dynamic = "force-dynamic";
export default async function GestioneLabel() {
  if (!await ownerSession(await headers())) redirect("/accesso");
  return <main className="news-editor">
    <p className="eyebrow">SITO · EMME LABEL</p>
    <h1>Gestione Label</h1>
    <p>Gestisci il roster pubblico e le pubblicazioni della Label. Le bozze restano nel portale.</p>
    <Editor/>
  </main>;
}
