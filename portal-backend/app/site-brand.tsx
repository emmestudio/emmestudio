"use client";
import Link from 'next/link';import Image from 'next/image';import {usePathname} from 'next/navigation';
export default function SiteBrand(){const publicPage=usePathname().startsWith('/news/');return <Link href={publicPage?'https://emmestudioproduction.it/':'/dashboard'} className="portal-brand" aria-label={publicPage?'Emme Studio, sito principale':'Emme Studio, panoramica del portale'}><Image src="/logo-white.png" alt="Emme Studio" width={150} height={75} priority/></Link>;}
