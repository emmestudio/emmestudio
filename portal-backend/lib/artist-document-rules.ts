import type { ProductionItem } from "./production-data";
import type { StudioProject } from "./project-data";

export type ArtistDocumentSuggestion = {
  template: string;
  workId: string | null;
  workTitle: string;
  reason: string;
};

export function suggestArtistDocuments(
  artistId: string,
  labelRoster: boolean,
  projects: StudioProject[],
  production: ProductionItem[],
): ArtistDocumentSuggestion[] {
  const suggestions: ArtistDocumentSuggestion[] = [];
  const add = (template: string, reason: string, work?: { id: string; title: string }) => {
    suggestions.push({ template, reason, workId: work?.id ?? null, workTitle: work?.title ?? "" });
  };
  if (labelRoster) {
    add("artist-profile-v1", "Raccogli dati, recapiti e referenti all’ingresso nel roster.");
    add("label-collaboration-v1", "Verifica le condizioni della collaborazione con Emme Label.");
  }

  const artistProjects = projects.filter(p => p.artistId === artistId && !p.deletedAt);
  const activeProjects = new Set(artistProjects.filter(p => p.status !== "Archiviato").map(p => p.id));
  const works = production.filter(item => item.status !== "Archiviato" && item.status !== "Archiviata" &&
    (item.projectId ? activeProjects.has(item.projectId) : item.artistId === artistId));
  const releaseProjects = new Set(artistProjects.filter(project =>
    activeProjects.has(project.id) && ["Singolo", "Album"].includes(project.kind)).map(project => project.id));
  const trackIds = new Set(works.filter(item => item.kind === "track").map(item => item.id));

  function release(work: { id: string; title: string }) {
    add("digital-distribution-v1", "Da valutare se Emme Studio o Emme Label curerà la distribuzione dell’uscita.", work);
    add("release-approval-v1", "Da valutare quando audio, copertina e metadati saranno pronti per l’approvazione.", work);
    if (labelRoster) {
      add("label-release-agreement-v1", "Da valutare se questa uscita verrà pubblicata con Emme Label.", work);
      add("coproduction-v1", "Da valutare se la produzione è condivisa con Emme Studio, Emme Label o altri produttori.", work);
      add("performer-credits-v1", "Da valutare se partecipano featuring, coristi o musicisti di sessione.", work);
      add("third-party-materials-v1", "Da valutare se usi beat, sample, artwork o altri materiali di terzi.", work);
      add("master-license-v1", "Da valutare se la Label dovrà utilizzare un master di cui l’artista dispone.", work);
    }
  }

  for (const project of artistProjects) {
    if (!activeProjects.has(project.id)) continue;
    const children = works.filter(item => item.projectId === project.id);
    if (releaseProjects.has(project.id)) {
      if (!children.some(item => ["track", "recording", "service"].includes(item.kind)))
        add("studio-services-v1", "Verifica quali attività di produzione sono state affidate allo Studio.", project);
      release(project);
      if (labelRoster && project.kind === "Singolo" && !children.some(item => item.kind === "track"))
        add("author-split-v1", "Da valutare se l’inedito è scritto a più mani.", project);
    } else if (project.kind === "Live" && !children.some(item => item.kind === "live")) {
      add("live-production-v1", "Il progetto riguarda la produzione di uno spettacolo.", project);
    }
  }

  for (const work of works) {
    if (work.kind === "live") {
      add("live-production-v1", "La scheda comprende un lavoro di produzione musicale o tecnica dal vivo.", work);
      continue;
    }
    if (work.kind !== "track" && work.kind !== "recording" && work.kind !== "service") continue;
    if (work.kind === "recording" && work.trackId && trackIds.has(work.trackId)) continue;
    add("studio-services-v1", work.kind === "recording"
      ? "Verifica l’incarico relativo alla sessione di registrazione."
      : "Verifica l’incarico relativo alle attività affidate allo Studio.", work);
    if (work.kind === "track") {
      if (!work.projectId || !releaseProjects.has(work.projectId)) release(work);
      if (labelRoster) add("author-split-v1", "Da valutare se l’inedito è scritto a più mani.", work);
    }
    if ((work.kind === "track" && work.status === "Consegnato") ||
        (work.kind === "service" && work.status === "Completato")) {
      add("delivery-approval-v1", "Da valutare per documentare la consegna e l’approvazione dei materiali.", work);
    }
  }
  return suggestions;
}
