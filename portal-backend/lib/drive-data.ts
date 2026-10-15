export const driveScope = "https://www.googleapis.com/auth/drive.file";
export const artistFolders = [
  ["direction", "01 · Profilo e direzione artistica"],
  ["music", "02 · Produzione musicale"],
  ["image", "03 · Immagine e comunicazione"],
  ["live", "04 · Produzioni live"],
  ["documents", "05 · Documenti e accordi"],
] as const;
export const liveFolders = [
  ["organization", "01 · Direzione e organizzazione"],
  ["band", "02 · Band"],
  ["service", "03 · Service e tecnica"],
  ["sequences", "04 · Sequenze e programmazioni"],
  ["lights", "05 · Luci e video"],
  ["logistics", "06 · Logistica"],
  ["communication", "07 · Comunicazione"],
  ["documents", "08 · Documenti e consuntivo"],
] as const;
export type DriveSubject = "artist" | "live";
export type DriveFolder = { key: string; id: string; name: string; state: "planned" | "ready" | "error"; error: string };
export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
export class DriveError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
