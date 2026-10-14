import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { put, get, list, del } from "@vercel/blob";
import { exportWorkspace } from "./workspace-export";
const options = () => ({ storeId: process.env.BLOB_STORE_ID });
export const backupPrefix = (owner: string) =>
  "studio-backups/" +
  createHash("sha256").update(owner).digest("hex").slice(0, 24) +
  "/";
export function cronAuthorized(
  header: string | null,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32 || !header) return false;
  const a = Buffer.from(header),
    b = Buffer.from("Bearer " + secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function createBackup(owner: string) {
  const document = JSON.stringify(await exportWorkspace(owner));
  const path =
    backupPrefix(owner) +
    new Date().toISOString().replaceAll(":", "-") +
    "-" +
    randomUUID() +
    ".json";
  const blob = await put(path, document, {
    ...options(),
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });
  try {
    const stored = await get(blob.pathname, {
      ...options(),
      access: "private",
      useCache: false,
    });
    if (!stored || stored.statusCode !== 200)
      throw new Error("BACKUP_READBACK_FAILED");
    const bytes = await new Response(stored.stream).text();
    const checksum = (s: string) =>
      createHash("sha256").update(s).digest("hex");
    if (checksum(bytes) !== checksum(document))
      throw new Error("BACKUP_CHECKSUM_FAILED");
    return {
      pathname: blob.pathname,
      verified: true,
      bytes: Buffer.byteLength(document),
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    await del(blob.pathname, options()).catch(() => {});
    throw e;
  }
}
export async function listBackups(owner: string) {
  const r = await list({
    ...options(),
    prefix: backupPrefix(owner),
    limit: 1000,
  });
  return {
    files: r.blobs
      .map((b) => ({
        pathname: b.pathname,
        bytes: b.size,
        createdAt: b.uploadedAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    hasMore: r.hasMore,
  };
}
export async function downloadBackup(owner: string, path: string) {
  if (
    !path.startsWith(backupPrefix(owner)) ||
    !path.endsWith(".json") ||
    path.includes("..")
  )
    return null;
  return get(path, { ...options(), access: "private", useCache: false });
}
