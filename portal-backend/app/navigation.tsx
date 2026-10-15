"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
export default function Navigation() {
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);
  const [admin, setAdmin] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setOpen(false);
    fetch("/api/workspace", { cache: "no-store", signal: c.signal })
      .then(async (r) => {
        if (!r.ok) {
          setSignedIn(false);
          setAdmin(false);
          return;
        }
        const d = await r.json();
        setSignedIn(true);
        setAdmin(d.canManageAccess);
      })
      .catch(() => {});
    return () => c.abort();
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !container.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const links = signedIn
    ? [
        ["/dashboard", "Panoramica"],
        ["/lavoro", "Il mio lavoro"],
        ["/artisti", "Artisti"],
        ["/progetti", "Progetti"],
        ["/produzione", "Produzione"],
        ["/attivita", "Attività"],
        ["/calendario", "Calendario"],
        ...(admin
          ? [
              ["/guadagni", "Guadagni"],
              ["/costi", "Costi"],
              ["/accessi", "Team e accessi"],
            ]
          : []),
      ]
    : [["/accesso", "Accesso team"]];
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const r = await authClient.signOut();
      if (r.error) throw Error();
      window.location.assign("/accesso");
    } catch {
      setError("Uscita non completata. Riprova.");
      setBusy(false);
    }
  }
  return (
    <div className="portal-navigation" ref={container}>
      <button
        type="button"
        className="portal-menu-toggle secondary"
        aria-controls="portal-links"
        aria-expanded={open}
        aria-label={open ? "Chiudi menu del portale" : "Apri menu del portale"}
        onClick={() => setOpen(!open)}
      >
        Menu <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      <nav
        id="portal-links"
        className={open ? "is-open" : ""}
        aria-label="Navigazione portale"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            document
              .querySelector<HTMLButtonElement>(".portal-menu-toggle")
              ?.focus();
          }
        }}
      >
        {links.map(([href, title]) => (
          <Link
            key={href}
            href={href}
            aria-current={
              pathname === href ||
              (href === "/progetti" && pathname.startsWith("/preventivi/"))
                ? "page"
                : undefined
            }
          >
            {title}
          </Link>
        ))}
        <Link href="/installa" aria-current={pathname === "/installa" ? "page" : undefined}>Installa app</Link>
        <a className="portal-site-link" href="https://emmestudioproduction.it/">
          Sito Emme Studio ↗
        </a>
        {signedIn ? (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => void signOut()}
          >
            {busy ? "Uscita…" : "Esci"}
          </button>
        ) : null}
      </nav>
      {error ? (
        <p className="navigation-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
