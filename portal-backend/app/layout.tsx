import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navigation from "./navigation";
import "./globals.css";
export const metadata: Metadata = {
  title: "Emme Studio — Portale",
  description: "Area di lavoro Emme Studio",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <header className="brand">
          <Link
            href="/dashboard"
            className="portal-brand"
            aria-label="Emme Studio, panoramica del portale"
          >
            <Image
              src="/logo-white.png"
              alt="Emme Studio"
              width={150}
              height={75}
              priority
            />
          </Link>
          <Navigation />
        </header>
        {children}
      </body>
    </html>
  );
}
