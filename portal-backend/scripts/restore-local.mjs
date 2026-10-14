// Restore verification tool for an EMPTY LOCAL database only. Never used in deployment.
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { restoreBusinessExport } from "../lib/backup-data.ts";
const url = new URL(
  process.env.EMME_RESTORE_DATABASE_URL || "postgres://invalid",
);
if (
  process.env.VERCEL_ENV ||
  process.env.EMME_ALLOW_LOCAL_RESTORE !== "1" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  !url.pathname.startsWith("/emme_restore_")
)
  throw new Error("RESTORE_LOCAL_EMPTY_DATABASE_ONLY");
const [file, owner] = process.argv.slice(2);
if (!file || !owner)
  throw new Error(
    "Usage: node scripts/restore-local.mjs <export.json> <existing-local-owner-id>",
  );
const pool = new Pool({ connectionString: url.toString(), max: 1 });
const c = await pool.connect();
try {
  await restoreBusinessExport(
    c,
    owner,
    JSON.parse(await readFile(file, "utf8")),
  );
  console.log(
    "EMME_LOCAL_RESTORE_VERIFIED: team access disabled until explicitly enabled.",
  );
} finally {
  c.release();
  await pool.end();
}
