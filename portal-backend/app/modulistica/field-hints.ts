const hints: Record<string, string> = {
  title: "Scrivi un titolo riconoscibile. Se lo lasci vuoto verrà usato il nome del modello.",
  place: "Indica il comune o il luogo a cui si riferisce il documento.",
  clientName: "Inserisci nome e cognome oppure la denominazione del soggetto che sottoscrive.",
  artistName: "Indica il nome d’arte, il gruppo o il progetto interessato.",
  clientTaxCode: "Riporta il codice fiscale o l’identificativo della persona o dell’ente.",
  clientAddress: "Indica via, numero civico, CAP, comune e provincia.",
  representative: "Indica chi agisce per conto dell’artista o dell’organizzazione.",
  representativeRole: "Specifica in quale veste firma, per esempio genitore o legale rappresentante.",
  scope: "Elenca i brani, le attività comprese e il materiale di partenza.",
  delivery: "Indica quando e come saranno consegnati i file.",
  deposit: "Indica l’importo o la percentuale e quando va versata.",
  balance: "Indica l’importo residuo e la scadenza concordata.",
  paymentMethod: "Indica il mezzo concordato, per esempio bonifico.",
  extraRevision: "Descrivi eventuali tariffe e come si approvano le revisioni aggiuntive.",
  cancellation: "Riporta gli accordi specifici su preavviso, spostamenti e annullamenti.",
  credit: "Scrivi il credito esatto da usare, per esempio Prodotto da Emme Studio.",
  dem: "Inserisci la quota DEM in percentuale, con massimo due decimali.",
  drm: "Inserisci la quota DRM in percentuale, con massimo due decimali.",
  share: "Inserisci la quota concordata in percentuale, con massimo due decimali.",
  reference: "Indica un nome file, un link o un riferimento che permetta di riconoscere il materiale.",
  notes: "Aggiungi soltanto precisazioni utili che non trovano spazio negli altri campi.",
  extraTerms: "Aggiungi eventuali condizioni specifiche già concordate dalle parti.",
};

export function fieldHint(key: string, label: string, type?: string) {
  if (key === "title" && label !== "Titolo del documento") return "Riporta il titolo esatto del brano, dell’uscita o dell’elemento di questa riga.";
  if (hints[key]) return hints[key];
  if (type === "select") return "Scegli l’opzione che descrive il caso concreto.";
  if (type === "date") return "Seleziona la data di riferimento per questa voce.";
  if (type === "email") return "Inserisci un indirizzo email valido per il soggetto indicato.";
  if (type === "tel") return "Inserisci il numero di contatto, con prefisso se necessario.";
  return type === "textarea" ? "Descrivi questa voce in modo concreto, con riferimenti o condizioni concordate." :
    "Riporta il dato come deve comparire nel documento.";
}
