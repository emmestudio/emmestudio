import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Image from "next/image";
import Navigation from "./navigation";
import "./globals.css";
export const metadata: Metadata = {
  title: "Emme Studio — Portale",
  description: "Area di lavoro Emme Studio",
  robots: { index: false, follow: false },
  applicationName: "Emme Studio",
  appleWebApp: { capable: true, title: "Emme Studio", statusBarStyle: "default" },
  icons: { apple: "/app-icon-180.png", icon: "/app-icon-192.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0c10" };
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
