export function normalizedArtistEmail(email: string): string {
 return email.trim().toLowerCase();
}
export function validArtistEmail(email: string): boolean {
 const normalized = normalizedArtistEmail(email);
 return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
export function artistCanAccess(verified: boolean, enabled: boolean, deleted: boolean): boolean {
 return verified && enabled && !deleted;
}
export function artistCanSeePreview(ownArtistId: string, requestedArtistId: string, status: string): boolean {
 return ownArtistId === requestedArtistId && ["ready", "approved", "revision_requested"].includes(status);
}
