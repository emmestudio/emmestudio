import { validDate } from "./event-data.ts";
import { validId } from "./task-data.ts";
export const standaloneServices = ["Riarrangiamento Cover","Servizio Mix","Servizio Master","Mix & Master","Reamp","Post-produzione audio","Altro"] as const;
export const sessionPhases = [
  "Registrazione strumenti",
  "Registrazione voce",
  "Editing",
  "Mix",
  "Mastering",
  "Altro",
] as const;
export type ProductionKind =
  "track" | "recording" | "material" | "revision" | "live" | "service";
export type Field = {
  key: string;
  label: string;
  type?: "textarea" | "url" | "date";
  required?: boolean;
};
export const productionSpecs: Record<
  ProductionKind,
  { label: string; singular: string; states: string[]; fields: Field[] }
> = {
  service: {label: "Servizi singoli", singular: "Servizio", states: ["Da pianificare", "In lavorazione", "Completato", "Archiviato"], fields: [{key:"service",label:"Tipo di servizio",required:true},{key:"serviceOther",label:"Specifica il servizio"},{key:"scope",label:"Attività concordate e consegne",type:"textarea"},{key:"url",label:"Cartella di lavoro",type:"url"}]},
  track: {
    label: "Brani",
    singular: "Brano",
    states: [
      "Preproduzione",
      "Registrazione",
      "Editing",
      "Mix",
      "Mastering",
      "Consegnato",
      "Archiviato",
    ],
    fields: [
      { key: "bpm", label: "BPM" },
      { key: "duration", label: "Durata (mm:ss)" },
      { key: "genre", label: "Genere / sound" },
      {
        key: "arrangement",
        label: "Arrangiamento e note di produzione",
        type: "textarea",
      },
      { key: "releaseDate", label: "Data uscita prevista", type: "date" },
      { key: "key", label: "Tonalità" },
      { key: "credits", label: "Crediti e musicisti", type: "textarea" },
      { key: "lyrics", label: "Testo del brano", type: "textarea" },
      {
        key: "meaning",
        label: "Significato e direzione musicale",
        type: "textarea",
      },
      { key: "reference", label: "Reference", type: "url" },
    ],
  },
  recording: {
    label: "Registrazioni",
    singular: "Registrazione",
    states: [
      "Pianificata",
      "In corso",
      "Completata",
      "Registrata",
      "Da rifare",
      "Archiviata",
    ],
    fields: [
      { key: "phase", label: "Fase di produzione" },
      { key: "instrument", label: "Strumento / parte" },
      { key: "musician", label: "Musicista / voce / referente" },
      { key: "engineer", label: "Tecnico / studio" },
      { key: "recordedOn", label: "Data sessione", type: "date" },
      { key: "sessionLink", label: "Sessione o cartella Drive", type: "url" },
      { key: "studio", label: "Sala / studio" },
      { key: "take", label: "Take / versione di lavoro" },
      {
        key: "result",
        label: "Esito sessione e prossimi passi",
        type: "textarea",
      },
    ],
  },
  material: {
    label: "Materiali e versioni",
    singular: "Materiale",
    states: [
      "In lavorazione",
      "Da verificare",
      "Definitivo",
      "Consegnato",
      "Archiviato",
    ],
    fields: [
      {
        key: "category",
        label: "Tipo materiale (mix, master, sessione, artwork…)",
        required: true,
      },
      { key: "versionLabel", label: "Versione (es. Mix v03)", required: true },
      {
        key: "url",
        label: "Link file / cartella Drive",
        type: "url",
        required: true,
      },
    ],
  },
  revision: {
    label: "Revisioni",
    singular: "Revisione",
    states: [
      "Da valutare",
      "In lavorazione",
      "Da approvare",
      "Approvata",
      "Archiviata",
    ],
    fields: [
      {
        key: "versionLabel",
        label: "Versione oggetto della revisione",
        required: true,
      },
      {
        key: "feedback",
        label: "Feedback ricevuto e modifiche richieste",
        type: "textarea",
        required: true,
      },
      { key: "resolution", label: "Interventi effettuati", type: "textarea" },
      { key: "url", label: "Link versione / evidenza", type: "url" },
      { key: "approvalSource", label: "Approvazione ricevuta da / tramite" },
      { key: "approvalOn", label: "Data approvazione", type: "date" },
    ],
  },
  live: {
    label: "Show live",
    singular: "Show live",
    states: [
      "Pianificazione",
      "In preparazione",
      "Pronto",
      "Realizzato",
      "Archiviato",
    ],
    fields: [
      { key: "showDate", label: "Data show", type: "date" },
      { key: "venue", label: "Luogo / venue" },
      { key: "band", label: "Organico e ruoli", type: "textarea" },
      {
        key: "setlist",
        label: "Scaletta e durata dei brani",
        type: "textarea",
      },
      { key: "rehearsals", label: "Piano prove", type: "textarea" },
      {
        key: "service",
        label: "Service e referenti tecnici",
        type: "textarea",
      },
      { key: "rider", label: "Rider / stage plot", type: "url" },
      { key: "sequences", label: "Sequenze, click e cue", type: "textarea" },
      {
        key: "timecode",
        label: "LTC / MTC e sincronizzazioni",
        type: "textarea",
      },
      { key: "midi", label: "MIDI e program change", type: "textarea" },
      { key: "visuals", label: "Luci e visual", type: "textarea" },
      {
        key: "backup",
        label: "Piano backup e verifica tecnica",
        type: "textarea",
      },
    ],
  },
};
export type ProductionDraft = {
  projectId: string;
  artistId?: string | null;
  kind: ProductionKind;
  title: string;
  status: string;
  assignee: string;
  assigneeEmail?: string | null;
  deadline: string | null;
  trackId: string | null;
  notes: string;
  details: Record<string, string>;
};
export type ProductionItem = ProductionDraft & {
  id: string;
  version: number;
  updatedAt: string;
};
export type ProductionHistory = {
  version: number;
  actor: string;
  recordedAt: string;
  data: ProductionDraft;
};
export class ProductionInputError extends Error {}
export function emptyProduction(
  kind: ProductionKind,
  projectId = "",
): ProductionDraft {
  return {
    projectId,
    kind,
    title: "",
    status: productionSpecs[kind].states[0],
    assignee: "",
    assigneeEmail: null,
    deadline: null,
    trackId: null,
    notes: "",
    details: Object.fromEntries(
      productionSpecs[kind].fields.map((f) => [f.key, ""]),
    ),
  };
}
export function safeLink(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export function validateProduction(input: unknown): ProductionDraft {
  if (!input || typeof input !== "object")
    throw new ProductionInputError("Scheda non valida.");
  const d = input as Record<string, unknown>;
  if (
    (!validId(d.projectId) && !((d.projectId === "" || d.projectId === null || d.projectId === undefined) && validId(d.artistId))) ||
    (d.artistId != null && d.artistId !== "" && !validId(d.artistId)) ||
    typeof d.kind !== "string" ||
    !Object.hasOwn(productionSpecs, d.kind)
  )
    throw new ProductionInputError("Seleziona un artista o un progetto e il tipo di scheda.");
  const kind = d.kind as ProductionKind;
  const spec = productionSpecs[kind];
  const text = (k: string, max: number, required = false) => {
    if (
      typeof d[k] !== "string" ||
      (d[k] as string).length > max ||
      (required && !(d[k] as string).trim())
    )
      throw new ProductionInputError("Controlla titolo, responsabile e note.");
    return (d[k] as string).trim();
  };
  if (typeof d.status !== "string" || !spec.states.includes(d.status))
    throw new ProductionInputError("Stato non valido.");
  if (
    d.deadline !== null &&
    (typeof d.deadline !== "string" || !validDate(d.deadline))
  )
    throw new ProductionInputError("Scadenza non valida.");
  if (d.trackId !== null && !validId(d.trackId))
    throw new ProductionInputError("Brano non valido.");
  if (
    (kind === "track" && d.trackId !== null) ||
    (kind === "live" && d.trackId !== null) ||
    (kind === "service" && d.trackId !== null)
  )
    throw new ProductionInputError("Collegamento al brano non valido.");
  if (!d.details || typeof d.details !== "object" || Array.isArray(d.details))
    throw new ProductionInputError("Dettagli non validi.");
  const raw = d.details as Record<string, unknown>;
  const details: Record<string, string> = {};
  for (const f of spec.fields) {
    const v = raw[f.key] ?? (f.required ? undefined : "");
    if (
      typeof v !== "string" ||
      v.length > (f.type === "textarea" ? 10000 : 1000) ||
      (f.required && !v.trim())
    )
      throw new ProductionInputError(
        "Controlla " + f.label.toLowerCase() + ".",
      );
    details[f.key] = v.trim();
    if (v && f.type === "url" && !safeLink(v.trim()))
      throw new ProductionInputError("Inserisci un link HTTPS valido.");
    if (v && f.type === "date" && !validDate(v))
      throw new ProductionInputError("Data non valida.");
  }
  if(kind==="service") {
    if(!standaloneServices.includes(details.service as typeof standaloneServices[number]))throw new ProductionInputError("Seleziona il tipo di servizio.");
    if(details.service==="Altro" && !details.serviceOther.trim())throw new ProductionInputError("Specifica il servizio selezionando Altro.");
    if(details.service!=="Altro")details.serviceOther="";
  }
  if (
    kind === "track" &&
    details.bpm &&
    (!/^\d{1,3}(\.\d{1,2})?$/.test(details.bpm) ||
      Number(details.bpm) <= 0 ||
      Number(details.bpm) > 400)
  )
    throw new ProductionInputError("BPM non validi.");
  if (kind === "recording") {
    if (
      details.phase &&
      !sessionPhases.includes(details.phase as (typeof sessionPhases)[number])
    )
      throw new ProductionInputError("Fase di produzione non valida.");
    if (
      (!details.phase ||
        details.phase === "Registrazione strumenti" ||
        details.phase === "Registrazione voce") &&
      (!details.instrument || !details.musician)
    )
      throw new ProductionInputError(
        "Indica parte e musicista della registrazione.",
      );
  }
  if (
    kind === "revision" &&
    d.status === "Approvata" &&
    (!details.approvalOn || !details.approvalSource)
  )
    throw new ProductionInputError(
      "Indica data e provenienza dell’approvazione ricevuta.",
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (
    kind === "revision" &&
    d.status === "Approvata" &&
    details.approvalOn > today
  )
    throw new ProductionInputError(
      "L’approvazione deve essere già stata ricevuta.",
    );
  if (
    kind === "recording" &&
    (d.status === "Registrata" || d.status === "Completata") &&
    (!details.recordedOn || details.recordedOn > today)
  )
    throw new ProductionInputError(
      "Inserisci la data effettiva della registrazione.",
    );
  if (
    kind === "live" &&
    d.status === "Realizzato" &&
    (!details.showDate || details.showDate > today)
  )
    throw new ProductionInputError("Inserisci la data effettiva dello show.");
  if ((kind === "material" || kind === "revision") && !d.trackId)
    throw new ProductionInputError(
      "Materiali e revisioni devono essere collegati a un brano.",
    );
  return {
    assigneeEmail: d.assigneeEmail as string | null | undefined,
    projectId: typeof d.projectId === "string" ? d.projectId : "",
    artistId: typeof d.artistId === "string" && d.artistId ? d.artistId : null,
    kind,
    title: text("title", 300, true),
    status: d.status,
    assignee: text("assignee", 200),
    deadline: d.deadline as string | null,
    trackId: d.trackId as string | null,
    notes: text("notes", 10000),
    details,
  };
}
