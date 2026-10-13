export type WorkspaceRole = 'admin' | 'editor' | 'viewer';
export function canEdit(role: string) { return role === 'admin' || role === 'editor'; }
export function canManageAccess(role: string) { return role === 'admin'; }
export function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
export type MemberDraft = { email: string; name: string; role: 'editor' | 'viewer'; active: boolean };
export class MemberInputError extends Error {}
export function validateMember(input: unknown, ownerEmail: string): MemberDraft {
  if (!input || typeof input !== 'object') throw new MemberInputError('Dati accesso non validi.');
  const data = input as Record<string, unknown>;
  if (typeof data.email !== 'string') throw new MemberInputError('Inserisci un’email valida.');
  const email = normalizeEmail(data.email);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new MemberInputError('Inserisci un’email valida.');
  if (email === normalizeEmail(ownerEmail)) throw new MemberInputError('L’account amministratore si gestisce separatamente.');
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 200 || !['editor', 'viewer'].includes(String(data.role)) || typeof data.active !== 'boolean') throw new MemberInputError('Controlla nome, ruolo e stato dell’accesso.');
  return { email, name: data.name.trim(), role: data.role as 'editor' | 'viewer', active: data.active };
}
