import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerSession } from "@/lib/owner-session";
import Editor from "../gestione-label/editor";
import "../redazione/redazione.css";
import "../gestione-label/gestione-label.css";

export const dynamic = "force-dynamic";
export default async function GestionePartner() {
  if (!await ownerSession(await headers())) redirect("/accesso");
  return <main className="news-editor">
    <p className="eyebrow">SITO · EMME STUDIO</p>
    <h1>Gestione Partner</h1>
    <p>Prepara, pubblica e riordina le collaborazioni della pagina Partner. Le bozze sono visibili solo nel portale.</p>
    <Editor partnersOnly/>
  </main>;
}
