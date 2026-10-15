"use client";
import { useEffect, useState } from "react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export default function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", done); };
  }, []);
  async function install() {
    if (!prompt || busy) return;
    setBusy(true); setError("");
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") setInstalled(true);
    } catch { setError("Puoi installare l’app dal menu del browser seguendo le istruzioni qui sotto."); }
    finally { setPrompt(null); setBusy(false); }
  }
  if (installed) return <p role="status">L’app Emme Studio è già aperta o installata su questo dispositivo.</p>;
  return <>{prompt && <button className="button" disabled={busy} onClick={() => void install()}>{busy ? "Installazione…" : "Installa app"}</button>}{error && <p role="status">{error}</p>}</>;
}
