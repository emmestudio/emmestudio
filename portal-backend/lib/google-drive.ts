import "server-only";
import { DriveError } from "./drive-data";
export type GoogleFolder = { id: string; name: string; mimeType: string; trashed?: boolean; parents?: string[]; ownedByMe?: boolean };
export function googleDrive(token: string, transport: typeof fetch = fetch) {
  async function call(path: string, init?: RequestInit, strict404 = false) {
    let response: Response;
    try {
      response = await transport(`https://www.googleapis.com/drive/v3/${path}`, {
        ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        cache: "no-store", signal: AbortSignal.timeout(10000), redirect: "error",
      });
    } catch { throw new DriveError(502, "Drive non risponde. Riprova: le cartelle già create saranno recuperate."); }
    if (!response.ok) {
      if (response.status === 404 && !strict404) return null;
      throw new DriveError(response.status === 401 || response.status === 403 ? 403 : 502,
        response.status === 401 || response.status === 403
          ? "Google Drive non autorizzato. Verifica Drive API e rinnova il collegamento dall’Archivio Drive."
          : "Google Drive non ha completato l’operazione. Riprova tra poco.");
    }
    return response.status === 204 ? null : response.json();
  }
  return {
    async permissions(id: string) {
      const result: { id: string; type: string; role: string; emailAddress?: string; permissionDetails?: { inherited: boolean }[] }[] = [];
      let pageToken: string | undefined;
      do {
        const q = new URLSearchParams({ fields: "nextPageToken,permissions(id,type,role,emailAddress,permissionDetails(inherited))", supportsAllDrives: "true", pageSize: "100" });
        if (pageToken) q.set("pageToken", pageToken);
        const page = await call(`files/${encodeURIComponent(id)}/permissions?${q}`, undefined, true);
        if (!Array.isArray(page?.permissions)) throw new DriveError(502, "Permessi Drive non verificabili.");
        result.push(...page.permissions);
        pageToken = page.nextPageToken;
      } while (pageToken);
      return result;
    },
    async shareReader(id: string, emailAddress: string) {
      const result = await call(`files/${encodeURIComponent(id)}/permissions?supportsAllDrives=true&sendNotificationEmail=false&fields=id`, {
        method: "POST", body: JSON.stringify({ type: "user", role: "reader", emailAddress }),
      }, true);
      if (!result?.id) throw new DriveError(502, "Condivisione Drive da verificare.");
    },
    async revokePermission(id: string, permission: string) {
      await call(`files/${encodeURIComponent(id)}/permissions/${encodeURIComponent(permission)}?supportsAllDrives=true`, { method: "DELETE" });
    },
    async generateId(): Promise<string> {
      const data = await call("files/generateIds?count=1&space=drive&type=files");
      const id = data?.ids?.[0];
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{5,200}$/.test(id)) throw new DriveError(502, "Identificativo Drive non disponibile.");
      return id;
    },
    async get(id: string): Promise<GoogleFolder | null> {
      return call(`files/${encodeURIComponent(id)}?fields=id,name,mimeType,trashed,parents,ownedByMe`) as Promise<GoogleFolder | null>;
    },
    async create(id: string, name: string, parent: string | null): Promise<void> {
      const result = await call("files?fields=id", { method: "POST", body: JSON.stringify({ id, name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) }) });
      if (!result?.id) throw new DriveError(502, "Creazione cartella da verificare. Riprova per recuperarla.");
    },
    async update(id: string, name: string, parent: string | null, currentParents: string[]): Promise<void> {
      const q = new URLSearchParams({ fields: "id" });
      if (parent && !currentParents.includes(parent)) {
        q.set("addParents", parent);
        if (currentParents.length) q.set("removeParents", currentParents.join(","));
      }
      const result = await call(`files/${encodeURIComponent(id)}?${q}`, { method: "PATCH", body: JSON.stringify({ name }) });
      if (!result?.id) throw new DriveError(409, "Cartella non disponibile. Verifica che non sia stata eliminata da Drive.");
    },
  };
}
export type DriveClient = ReturnType<typeof googleDrive>;
