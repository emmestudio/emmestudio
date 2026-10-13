import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { workspaceSession } from '@/lib/workspace-session';
import Projects from './projects';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (!await workspaceSession(await headers())) redirect('/accesso');
  return <main className="shell"><span className="eyebrow">EMME STUDIO · ARTIST & PROJECT MANAGEMENT</span><h1>Una visione.<br /><em>Un progetto concreto.</em></h1><Projects /></main>;
}
