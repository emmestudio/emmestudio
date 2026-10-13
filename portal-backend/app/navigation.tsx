'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function Navigation() {
  const pathname = usePathname();
  return <nav aria-label="Navigazione portale">{[['/dashboard', 'Panoramica'], ['/progetti', 'Progetti'], ['/attivita', 'Attività'], ['/calendario', 'Calendario']].map(([href, title]) => <Link href={href} key={href} aria-current={pathname === href ? 'page' : undefined}>{title}</Link>)}</nav>;
}
