import { validDate } from "./event-data";
import { mediaEmbed } from "./news-data";

export const labelSocials = ["Instagram", "Spotify", "Facebook", "TikTok", "YouTube", "SoundCloud", "X", "Sito"] as const;
export const releaseTypes = ["Singolo", "EP", "Album"] as const;
export const labelSite = "https://emmestudioproduction.it";
export const labelPortal = "https://portal.emmestudioproduction.it";
export const moodyPhoto = labelSite + "/assets/cinematic-team/moody.webp";

export type LabelDraft = {
  kind: "artist" | "release";
  name: string;
  slug: string;
  tagline: string;
  body: string;
  links: Partial<Record<typeof labelSocials[number], string>>;
  artistSlug: string;
  artistName: string;
  type: string;
  date: string;
  spotify: string;
};
export type LabelEntry = LabelDraft & { id: string; version: number; published: boolean; publishedOnce: boolean; photo: string };
export const labelSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").slice(0, 100).replace(/^-+|-+$/g, "");

function secureUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw Error("Inserisci un indirizzo HTTPS valido.");
  return url.href;
}

export function validateLabelDraft(input: unknown, published: boolean): LabelDraft {
  if (!input || typeof input !== "object") throw Error("Scheda non valida.");
  const v = input as Record<string, unknown>;
  const field = (key: string, max: number) => {
    const value = v[key] ?? "";
    if (typeof value !== "string" || value.length > max) throw Error("Controlla il contenuto della scheda.");
    return value.trim();
  };
  const kind = v.kind;
  if (kind !== "artist" && kind !== "release") throw Error("Tipo di scheda non valido.");
  const name = field("name", 160), slug = field("slug", 100), body = field("body", 15000);
  if (!name || !slug || labelSlug(slug) !== slug) throw Error("Inserisci un nome e un indirizzo con lettere minuscole, numeri e trattini.");
  const draft: LabelDraft = { kind, name, slug, body, tagline: "", links: {}, artistSlug: "", artistName: "", type: "", date: "", spotify: "" };
  if (kind === "artist") {
    draft.tagline = field("tagline", 240);
    if (published && (!draft.tagline || !body)) throw Error("Per pubblicare l’artista, aggiungi sottotitolo e biografia.");
    const links = v.links as Record<string, unknown> | undefined;
    for (const social of labelSocials) {
      const url = links?.[social];
      if (!url) continue;
      try {
        if (typeof url !== "string" || url.length > 1500) throw Error();
        draft.links[social] = secureUrl(url.trim());
      } catch { throw Error("Controlla il link " + social + "."); }
    }
  } else {
    draft.artistSlug = field("artistSlug", 100);
    draft.artistName = field("artistName", 160);
    draft.type = field("type", 12);
    draft.date = field("date", 10);
    const spotify = field("spotify", 1500);
    if (draft.artistSlug && labelSlug(draft.artistSlug) !== draft.artistSlug) throw Error("Artista collegato non valido.");
    if (draft.date && !validDate(draft.date)) throw Error("Controlla la data di uscita.");
    if (draft.type && !releaseTypes.some(type => type === draft.type)) throw Error("Seleziona il formato dell’uscita.");
    if (spotify) {
      const embed = mediaEmbed(spotify);
      const match = embed?.match(/^https:\/\/open\.spotify\.com\/embed\/(track|album)\/([a-zA-Z0-9]{22})$/);
      if (!match) throw Error("Incolla il link Spotify di un brano, EP o album.");
      draft.spotify = "https://open.spotify.com/" + match[1] + "/" + match[2];
    }
    if (published && (!draft.artistName && !draft.artistSlug || !draft.type || !draft.date || !draft.spotify))
      throw Error("Per pubblicare indica artista, formato, data e link Spotify.");
  }
  return draft;
}
