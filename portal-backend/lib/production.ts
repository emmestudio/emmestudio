import "server-only";
import {writeQuote} from "./finance";
import type {QuoteDraft} from "./finance-data";
import { resolveAssignee } from "./team";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import {
  ProductionInputError,
  type ProductionDraft,
  type ProductionItem,
} from "./production-data";
export async function listProduction(owner: string): Promise<ProductionItem[]> {
  const r = await getDb().query(
    "SELECT r.id,r.version,r.data,r.updated_at,r.project_id,COALESCE(p.artist_id,r.artist_id) AS artist_id FROM studio_production r LEFT JOIN studio_projects p ON p.id=r.project_id AND p.owner_id=r.owner_id LEFT JOIN studio_artists a ON a.id=r.artist_id AND a.owner_id=r.owner_id WHERE r.owner_id=$1 AND r.deleted_at IS NULL AND ((r.project_id IS NOT NULL AND p.id IS NOT NULL AND p.deleted_at IS NULL) OR (r.project_id IS NULL AND a.id IS NOT NULL AND a.deleted_at IS NULL)) AND NOT EXISTS (SELECT 1 FROM studio_production t WHERE t.owner_id=r.owner_id AND t.id=NULLIF(r.data->>'trackId','')::uuid AND t.deleted_at IS NOT NULL) ORDER BY r.updated_at DESC LIMIT 5001",
    [owner],
  );
  if (r.rows.length > 5000) throw new Error("PRODUCTION_NEEDS_PAGINATION");
  return r.rows.map((r) => ({
    ...r.data,
    projectId: r.project_id ?? "",
    artistId: r.artist_id,
    id: r.id,
    version: r.version,
    updatedAt: r.updated_at.toISOString(),
  }));
}
export async function productionHistory(owner: string, id: string) {
  const r = await getDb().query(
    'SELECT version,actor,recorded_at AS "recordedAt",data FROM studio_production_history WHERE owner_id=$1 AND item_id=$2 ORDER BY version DESC',
    [owner, id],
  );
  return r.rows;
}
export async function saveProduction(
  owner: string,
  id: string,
  version: number | undefined,
  d: ProductionDraft,
  actor: string,
  financial?: {quote:QuoteDraft;quoteVersion:number},
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    let artistId = d.artistId || null;
    if (d.projectId) {
      const p = await c.query("SELECT status,artist_id FROM studio_projects WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",[owner,d.projectId]);
      if (!p.rows[0] || p.rows[0].status === "Archiviato") throw new ProductionInputError("Il progetto non è disponibile oppure è archiviato.");
      if (artistId && artistId !== p.rows[0].artist_id) throw new ProductionInputError("L’artista deve corrispondere a quello del progetto.");
      artistId = p.rows[0].artist_id;
    }
    if (artistId) {
      const a = await c.query("SELECT id FROM studio_artists WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",[owner,artistId]);
      if (!a.rows[0]) throw new ProductionInputError("Artista non disponibile. Ripristina prima il suo profilo.");
    } else if (!d.projectId) throw new ProductionInputError("Seleziona l’artista per questo lavoro singolo.");
    d = {...d, artistId};
    const old = await c.query(
      "SELECT * FROM studio_production WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, id],
    );
    if (old.rows[0]?.deleted_at)
      throw new ProductionInputError(
        "Ripristina la scheda dal cestino prima di modificarla.",
      );
    const digest = createHash("sha256").update(JSON.stringify(financial ? {draft:d,financial} : d)).digest("hex");
    if (!version && old.rows[0]) {
      if (old.rows[0].request_digest !== digest)
        throw new ProductionInputError("Identificativo già utilizzato.");
      await c.query("COMMIT");
      return;
    }
    if (
      version &&
      (!old.rows[0] ||
        old.rows[0].version !== version ||
        old.rows[0].kind !== d.kind)
    )
      throw new ProductionInputError(
        "Scheda modificata. Aggiorna prima di riprovare.",
      );
    const contextChanged = old.rows[0] && ((old.rows[0].project_id ?? "") !== d.projectId || (!old.rows[0].project_id && (old.rows[0].artist_id ?? null) !== artistId));
    if (contextChanged && old.rows[0].data.trackId) throw new ProductionInputError("Modifica artista e progetto dalla scheda del brano principale.");
    if (contextChanged) {
      const linked = await c.query("SELECT id FROM studio_hours WHERE owner_id=$1 AND production_id IN (SELECT id FROM studio_production WHERE owner_id=$1 AND (id=$2 OR data->>'trackId'=$2::text)) UNION ALL SELECT id FROM studio_delivery WHERE owner_id=$1 AND track_id=$2 LIMIT 1",[owner,id]);
      if (linked.rows[0]) throw new ProductionInputError("Questo lavoro ha ore o verifiche legate al progetto. Gestisci prima quei collegamenti prima di spostarlo.");
    }
    if (old.rows[0]?.data.trackId) {
      const parent = await c.query(
        "SELECT id FROM studio_production WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL",
        [owner, old.rows[0].data.trackId],
      );
      if (!parent.rows[0])
        throw new ProductionInputError("Ripristina prima il brano collegato.");
    }
    if (d.trackId) {
      const track = await c.query(
        "SELECT id FROM studio_production WHERE owner_id=$1 AND project_id IS NOT DISTINCT FROM $2::uuid AND (project_id IS NOT NULL OR artist_id IS NOT DISTINCT FROM $4::uuid) AND id=$3 AND kind='track' AND deleted_at IS NULL",
        [owner, d.projectId || null, d.trackId, artistId],
      );
      if (!track.rows[0])
        throw new ProductionInputError(
          "Il brano deve appartenere allo stesso artista e allo stesso progetto, se presente.",
        );
    }
    const a =
      old.rows[0]?.data?.assigneeEmail &&
      old.rows[0].data.assigneeEmail === d.assigneeEmail
        ? undefined
        : await resolveAssignee(c, owner, d.assigneeEmail);
    d = {
      ...d,
      assigneeEmail:
        a === undefined
          ? (old.rows[0]?.data?.assigneeEmail ?? null)
          : (a?.email ?? null),
      assignee:
        a === undefined && old.rows[0]?.data?.assigneeEmail
          ? old.rows[0].data.assignee
          : (a?.name ?? d.assignee),
    };
    if (d.kind === "track" && d.status === "Consegnato") {
      const missing = await c.query(
        "SELECT id FROM studio_delivery WHERE owner_id=$1 AND project_id=$2 AND track_id=$3 AND required=true AND done=false LIMIT 1",
        [owner, d.projectId || null, id],
      );
      if (missing.rows[0])
        throw new ProductionInputError(
          "Completa le verifiche obbligatorie del brano prima della consegna.",
        );
    }
    const next = version ? version + 1 : 1;
    if (version)
      await c.query(
        "UPDATE studio_production SET data=$3,version=$4,project_id=$5,artist_id=$6,updated_at=now() WHERE owner_id=$1 AND id=$2",
        [owner, id, JSON.stringify(d), next, d.projectId || null, artistId],
      );
    else
      await c.query(
        "INSERT INTO studio_production(id,owner_id,project_id,kind,data,request_digest,artist_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, owner, d.projectId || null, d.kind, JSON.stringify(d), digest, artistId],
      );
    if (contextChanged) {
      const children = await c.query("UPDATE studio_production SET project_id=$3::uuid,artist_id=$4::uuid,data=jsonb_set(jsonb_set(data,'{projectId}',to_jsonb($5::text)),'{artistId}',COALESCE(to_jsonb($4::uuid),'null'::jsonb)),version=version+1,updated_at=now() WHERE owner_id=$1 AND data->>'trackId'=$2::text RETURNING id,version,data",[owner,id,d.projectId || null,artistId,d.projectId]);
      for (const child of children.rows) await c.query("INSERT INTO studio_production_history(item_id,owner_id,version,data,actor) VALUES($1,$2,$3,$4,$5)",[child.id,owner,child.version,JSON.stringify(child.data),actor]);
    }
    await c.query(
      "INSERT INTO studio_production_history(item_id,owner_id,version,data,actor) VALUES($1,$2,$3,$4,$5)",
      [id, owner, next, JSON.stringify(d), actor],
    );
    if(financial)await writeQuote(c,owner,id,financial.quote,financial.quoteVersion,"production");
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    if (e instanceof Error && e.message === "ASSIGNEE_INVALID")
      throw new ProductionInputError(
        "Seleziona una persona abilitata del team.",
      );
    throw e;
  } finally {
    c.release();
  }
}
