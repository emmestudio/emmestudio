import 'server-only';
import { getAuth } from './auth';
import { configurationReady, ownerAllowed } from './config';
export async function ownerSession(headers: Headers) {
  if (!configurationReady()) return null;
  const session = await getAuth().api.getSession({ headers });
  return session && ownerAllowed(session.user.email, session.user.emailVerified) ? session : null;
}
