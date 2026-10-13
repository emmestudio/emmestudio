import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ownerSession } from '@/lib/owner-session';
import Tasks from './tasks';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!await ownerSession(await headers())) redirect('/accesso');
  return <main className="shell"><span className="eyebrow">EMME STUDIO · ATTIVITÀ</span><h1>Ogni idea.<br /><em>Il suo prossimo passo.</em></h1><Tasks /></main>;
}
