"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export default function Login() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <><button className="button" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/calendario", errorCallbackURL: "/accesso?error=1" });
      if (result.error) { setError("Accesso non riuscito. Verifica l’account dello studio e riprova."); setBusy(false); }
    } catch { setError("Connessione non disponibile. Riprova tra poco."); setBusy(false); }
  }}>{busy ? "Apertura Google…" : "Accedi con Google"}</button><p role="status">{error}</p></>;
}
