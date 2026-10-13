import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
export const metadata: Metadata = { title: "Emme Studio — Portale", description: "Area di lavoro Emme Studio", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="it"><body><header className="brand"><Image src="/logo-white.png" alt="Emme Studio" width={150} height={75} priority /></header>{children}</body></html>;
}
