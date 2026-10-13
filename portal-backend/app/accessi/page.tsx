import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ownerSession } from '@/lib/owner-session';
import Members from './members';
export const dynamic = 'force-dynamic';
export default async function Page() { if (!await ownerSession(await headers())) redirect('/dashboard'); return <main className="shell"><span className="eyebrow">EMME STUDIO · AMMINISTRAZIONE</span><h1>Il nostro team.<br /><em>Gli accessi giusti.</em></h1><Members /></main>; }
