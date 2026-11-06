import { validId } from "./task-data";

export const signedDocumentLimitMb = 20;
export const signedDocumentLimit = signedDocumentLimitMb * 1024 * 1024;
export const directDocumentLimit = 4 * 1024 * 1024;

export function signedDocumentPath(id: string, attempt: string) {
  return `artist-signed-forms/${id}/${attempt}`;
}

export function validSignedDocumentPath(id: string, pathname: unknown): pathname is string {
  if (typeof pathname !== "string") return false;
  const attempt = pathname.split("/").at(-1);
  return validId(attempt) && pathname === signedDocumentPath(id, attempt);
}
