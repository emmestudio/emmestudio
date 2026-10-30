import {headers} from 'next/headers';import {redirect} from 'next/navigation';import {ownerSession} from '@/lib/owner-session';import Editor from './editor';import './redazione.css';
export const dynamic='force-dynamic';
export default async function Redazione(){if(!await ownerSession(await headers()))redirect('/accesso');return <main className="news-editor"><p className="eyebrow">SITO · REDAZIONE</p><h1>News.</h1><p>Prepara gli articoli di Studio e Label. Solo i contenuti pubblicati saranno visibili sul sito.</p><Editor/></main>;}
