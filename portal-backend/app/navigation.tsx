"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
export default function Navigation() {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/workspace", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          setAdmin(data.canManageAccess);
          setSignedIn(true);
        } else {
          setAdmin(false);
          setSignedIn(false);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  return (
    <nav aria-label="Navigazione portale">
      {[
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
              ["/accessi", "Accessi"],
            ]
          : []),
      ].map(([href, title]) => (
        <Link
          href={href}
          key={href}
          aria-current={pathname === href ? "page" : undefined}
        >
          {title}
        </Link>
      ))}
      {signedIn ? (
        <button
          className="text-button"
          onClick={async () => {
            await authClient.signOut();
            window.location.assign("/accesso");
          }}
        >
          Esci
        </button>
      ) : null}
    </nav>
  );
}
