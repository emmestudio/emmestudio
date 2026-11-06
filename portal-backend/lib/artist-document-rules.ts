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
    add("label-collaboration-v1", "Verifica le condizioni della collaborazione con Emme Label.");
  }

  const artistProjects = projects.filter(p => p.artistId === artistId && !p.deletedAt);
  const activeProjects = new Set(artistProjects.filter(p => p.status !== "Archiviato").map(p => p.id));
  const works = production.filter(item => item.status !== "Archiviato" && item.status !== "Archiviata" &&
    (item.projectId ? activeProjects.has(item.projectId) : item.artistId === artistId));
  const trackIds = new Set(works.filter(item => item.kind === "track").map(item => item.id));

  function release(work: { id: string; title: string }) {
    add("digital-distribution-v1", "Da valutare se Emme Studio o Emme Label curerà la distribuzione dell’uscita.", work);
    add("release-approval-v1", "Da valutare quando audio, copertina e metadati saranno pronti per l’approvazione.", work);
    if (labelRoster) {
      add("label-release-agreement-v1", "Da valutare se questa uscita verrà pubblicata con Emme Label.", work);
      add("master-license-v1", "Da valutare se la Label dovrà utilizzare un master di cui l’artista dispone.", work);
    }
  }

  for (const project of artistProjects) {
    if (!activeProjects.has(project.id) || works.some(item => item.projectId === project.id &&
        ["track", "recording", "service", "live"].includes(item.kind))) continue;
    if (project.kind === "Live") {
      add("live-production-v1", "Il progetto riguarda la produzione di uno spettacolo.", project);
    } else if (project.kind === "Singolo" || project.kind === "Album") {
      add("studio-services-v1", "Verifica quali attività di produzione sono state affidate allo Studio.", project);
      release(project);
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
    if (work.kind === "track") release(work);
    if ((work.kind === "track" && work.status === "Consegnato") ||
        (work.kind === "service" && work.status === "Completato")) {
      add("delivery-approval-v1", "Da valutare per documentare la consegna e l’approvazione dei materiali.", work);
    }
  }
  return suggestions;
}
