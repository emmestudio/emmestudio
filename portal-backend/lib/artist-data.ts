export type ArtistDraft = {
  name: string;
  email: string;
  phone: string;
  genre: string;
  links: string;
  notes: string;
  direction: boolean;
  director: string;
  objectives: string;
};
export type StudioArtist = ArtistDraft & { id: string; version: number };
export class ArtistInputError extends Error {}
export const emptyArtist = (): ArtistDraft => ({
  name: "",
  email: "",
  phone: "",
  genre: "",
  links: "",
  notes: "",
  direction: false,
  director: "",
  objectives: "",
});
export function validateArtist(input: unknown): ArtistDraft {
  if (!input || typeof input !== "object")
    throw new ArtistInputError("Profilo artista non valido.");
  const d = input as Record<string, unknown>;
  const result = emptyArtist();
  for (const key of [
    "name",
    "email",
    "phone",
    "genre",
    "links",
    "notes",
    "director",
    "objectives",
  ] as const) {
    if (
      typeof d[key] !== "string" ||
      d[key].length >
        (["notes", "objectives", "links"].includes(key) ? 5000 : 200)
    )
      throw new ArtistInputError("Controlla i dati del profilo.");
    result[key] = (d[key] as string).trim();
  }
  if (
    !result.name ||
    (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) ||
    typeof d.direction !== "boolean"
  )
    throw new ArtistInputError("Inserisci nome e contatti validi.");
  result.direction = d.direction;
  return result;
}
export function workGroup(status: string) {
  return status === "Completato"
    ? "Realizzati"
    : status === "Archiviato"
      ? "Archivio"
      : status === "Pianificazione"
        ? "Da realizzare"
        : "In realizzazione";
}
