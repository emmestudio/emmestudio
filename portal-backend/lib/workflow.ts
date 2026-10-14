import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { getDb } from "./db";
import { resolveAssignee } from "./team";
import {
  templates,
  validateHours,
  validateDelivery,
  WorkInputError,
  type Hour,
  type Delivery,
} from "./work-data";
import { emptyProduction } from "./production-data";
import { validId } from "./task-data";
export async function listWorkflow(owner: string) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const h = await c.query(
      'SELECT id,version,project_id AS "projectId",production_id AS "productionId",person_email AS "personEmail",worked_on AS "workedOn",minutes,category,description,void_reason AS "voidReason" FROM studio_hours WHERE owner_id=$1 ORDER BY worked_on DESC,created_at DESC',
      [owner],
    );
    const d = await c.query(
      'SELECT id,version,project_id AS "projectId",track_id AS "trackId",label,done,required,assignee_email AS "assigneeEmail",due_date AS "dueDate",notes FROM studio_delivery WHERE owner_id=$1 ORDER BY created_at,id',
      [owner],
    );
    const p = await c.query(
      'SELECT project_id AS "projectId",template,planned_minutes AS "plannedMinutes",version FROM studio_workflow WHERE owner_id=$1',
      [owner],
    );
    await c.query("COMMIT");
    return {
      hours: h.rows as Hour[],
      delivery: d.rows as Delivery[],
      plans: p.rows,
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function workHistory(owner: string, id: string) {
  return (
    await getDb().query(
      'SELECT kind,version,snapshot,actor,recorded_at AS "recordedAt" FROM studio_work_history WHERE owner_id=$1 AND resource_id=$2 ORDER BY recorded_at DESC',
      [owner, id],
    )
  ).rows;
}
export async function saveWorkflow(
  owner: string,
  actorEmail: string,
  role: string,
  b: Record<string, any>,
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    if (!validId(b.projectId))
      throw new WorkInputError("Seleziona un progetto.");
    const p = await c.query(
      "SELECT * FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, b.projectId],
    );
    if (!p.rows[0]) throw new WorkInputError("Progetto non disponibile.");
    const actor = actorEmail.toLowerCase();
    if (b.action === "hours") {
      const d = validateHours(b.draft);
      if (d.projectId !== b.projectId || !validId(b.id))
        throw new WorkInputError("Riferimenti non validi.");
      const old = await c.query(
        "SELECT * FROM studio_hours WHERE owner_id=$1 AND id=$2 FOR UPDATE",
        [owner, b.id],
      );
      if (
        old.rows[0] &&
        (old.rows[0].project_id !== b.projectId ||
          (old.rows[0].person_email !== actor && role !== "admin"))
      )
        throw new WorkInputError("Puoi modificare soltanto le tue ore.");
      let person = actor;
      if (role === "admin" && b.personEmail) {
        const personInfo = await resolveAssignee(c, owner, b.personEmail);
        if (!personInfo) throw new WorkInputError("Persona non valida.");
        person = personInfo.email;
      }
      if (old.rows[0]) person = old.rows[0].person_email;
      if (d.productionId) {
        const item = await c.query(
          "SELECT id FROM studio_production WHERE owner_id=$1 AND project_id=$2 AND id=$3",
          [owner, b.projectId, d.productionId],
        );
        if (!item.rows[0])
          throw new WorkInputError(
            "Scheda produttiva non disponibile per questo progetto.",
          );
      }
      const digest = createHash("sha256")
        .update(JSON.stringify({ d, person }))
        .digest("hex");
      if (!b.version && old.rows[0]) {
        if (old.rows[0].request_digest !== digest)
          throw new WorkInputError("Identificativo già utilizzato.");
        await c.query("COMMIT");
        return;
      }
      if (
        b.version &&
        (!old.rows[0] ||
          old.rows[0].version !== b.version ||
          old.rows[0].void_reason)
      )
        throw new WorkInputError(
          "Registrazione modificata o annullata. Aggiorna e riaprila.",
        );
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,1))", [
        owner + ":" + person + ":" + d.workedOn,
      ]);
      const total = await c.query(
        "SELECT COALESCE(sum(minutes),0) AS minutes FROM studio_hours WHERE owner_id=$1 AND person_email=$2 AND worked_on=$3 AND void_reason IS NULL AND id<>$4",
        [owner, person, d.workedOn, b.id],
      );
      if (Number(total.rows[0].minutes) + d.minutes > 1440)
        throw new WorkInputError(
          "Il totale giornaliero non può superare 24 ore.",
        );
      const v = [
        b.id,
        owner,
        b.projectId,
        person,
        d.workedOn,
        d.minutes,
        d.category,
        d.description,
        d.productionId,
      ];
      if (b.version)
        await c.query(
          "UPDATE studio_hours SET worked_on=$5,minutes=$6,category=$7,description=$8,production_id=$9,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND project_id=$3 AND person_email=$4",
          v,
        );
      else
        await c.query(
          `INSERT INTO studio_hours(id,owner_id,project_id,person_email,worked_on,minutes,category,description,production_id,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [...v, digest],
        );
      await c.query(
        `INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          b.id,
          owner,
          "hours",
          b.version ? b.version + 1 : 1,
          JSON.stringify({ ...d, personEmail: person }),
          actor,
        ],
      );
    } else if (b.action === "voidHours") {
      if (
        !validId(b.id) ||
        typeof b.reason !== "string" ||
        b.reason.trim().length < 3 ||
        b.reason.length > 1000
      )
        throw new WorkInputError("Indica la motivazione.");
      const old = await c.query(
        "SELECT * FROM studio_hours WHERE owner_id=$1 AND project_id=$2 AND id=$3 FOR UPDATE",
        [owner, b.projectId, b.id],
      );
      if (
        !old.rows[0] ||
        old.rows[0].version !== b.version ||
        old.rows[0].void_reason ||
        (old.rows[0].person_email !== actor && role !== "admin")
      )
        throw new WorkInputError("Registrazione non modificabile.");
      await c.query(
        "UPDATE studio_hours SET void_reason=$3,version=version+1,updated_at=now() WHERE owner_id=$1 AND id=$2",
        [owner, b.id, b.reason.trim()],
      );
      await c.query(
        `INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,$3,$4,$5,$6)`,
        [
          b.id,
          owner,
          "hours",
          b.version + 1,
          JSON.stringify({ voidReason: b.reason.trim() }),
          actor,
        ],
      );
    } else if (b.action === "delivery") {
      const d = validateDelivery(b.draft);
      if (d.projectId !== b.projectId || !validId(b.id))
        throw new WorkInputError("Riferimenti non validi.");
      const old = await c.query(
        "SELECT * FROM studio_delivery WHERE owner_id=$1 AND id=$2 FOR UPDATE",
        [owner, b.id],
      );
      if (
        old.rows[0] &&
        (old.rows[0].version !== b.version ||
          old.rows[0].project_id !== b.projectId ||
          old.rows[0].track_id !== d.trackId)
      )
        throw new WorkInputError("Checklist modificata. Aggiorna e riaprila.");
      if (b.version && !old.rows[0])
        throw new WorkInputError("Voce non disponibile.");
      if (role !== "admin" && old.rows[0]?.required && !d.required)
        throw new WorkInputError(
          "Solo l’amministratore può rendere facoltativa una verifica obbligatoria.",
        );
      const a =
        old.rows[0]?.assignee_email &&
        old.rows[0].assignee_email === d.assigneeEmail
          ? { email: old.rows[0].assignee_email }
          : await resolveAssignee(c, owner, d.assigneeEmail);
      if (p.rows[0].status === "Archiviato")
        throw new WorkInputError("Il progetto è archiviato.");
      let delivered = false;
      if (d.trackId) {
        const t = await c.query(
          "SELECT data FROM studio_production WHERE owner_id=$1 AND project_id=$2 AND id=$3 AND kind='track'",
          [owner, b.projectId, d.trackId],
        );
        if (!t.rows[0]) throw new WorkInputError("Brano non disponibile.");
        delivered = t.rows[0].data.status === "Consegnato";
      }
      if (
        d.required &&
        !d.done &&
        (p.rows[0].status === "Completato" || delivered)
      )
        throw new WorkInputError(
          "Riattiva il progetto o il brano prima di riaprire una verifica obbligatoria.",
        );
      const next = old.rows[0] ? old.rows[0].version + 1 : 1;
      const values = [
        b.id,
        owner,
        b.projectId,
        d.trackId,
        d.label,
        d.done,
        d.required,
        a?.email ?? null,
        d.dueDate,
        d.notes,
        next,
        d.done ? actor : null,
      ];
      if (old.rows[0])
        await c.query(
          "UPDATE studio_delivery SET label=$5,done=$6,required=$7,assignee_email=$8,due_date=$9,notes=$10,version=$11,completed_by=CASE WHEN $6 THEN CASE WHEN done THEN completed_by ELSE $12 END ELSE NULL END,completed_at=CASE WHEN $6 THEN COALESCE(completed_at,now()) ELSE NULL END,updated_at=now() WHERE id=$1 AND owner_id=$2 AND project_id=$3 AND track_id IS NOT DISTINCT FROM $4",
          values,
        );
      else
        await c.query(
          "INSERT INTO studio_delivery(id,owner_id,project_id,track_id,label,done,required,assignee_email,due_date,notes,version,completed_by,completed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CASE WHEN $6 THEN now() ELSE NULL END)",
          values,
        );
      await c.query(
        `INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,$3,$4,$5,$6)`,
        [b.id, owner, "delivery", next, JSON.stringify(d), actor],
      );
    } else if (b.action === "plan" || b.action === "template") {
      if (
        !Number.isSafeInteger(b.plannedMinutes) ||
        b.plannedMinutes < 0 ||
        b.plannedMinutes > 600000
      )
        throw new WorkInputError("Stima ore non valida.");
      const old = await c.query(
        "SELECT * FROM studio_workflow WHERE owner_id=$1 AND project_id=$2 FOR UPDATE",
        [owner, b.projectId],
      );
      if ((old.rows[0]?.version ?? 0) !== b.version)
        throw new WorkInputError("Piano modificato. Aggiorna e riprova.");
      if (b.action === "template") {
        if (
          !Object.hasOwn(templates, b.template) ||
          !Number.isSafeInteger(b.trackCount) ||
          b.trackCount < 1 ||
          b.trackCount > 50 ||
          old.rows[0]?.template ||
          p.rows[0].status === "Archiviato" ||
          p.rows[0].status === "Completato"
        )
          throw new WorkInputError("Modello non applicabile o già applicato.");
        const spec = templates[b.template as keyof typeof templates];
        const a = await resolveAssignee(c, owner, b.assigneeEmail ?? null);
        for (const title of spec.tasks)
          await c.query(
            `INSERT INTO studio_tasks(id,owner_id,project_id,title,assignee,assignee_email,status,priority,notes,request_digest) VALUES($1,$2,$3,$4,$5,$6,'Da fare','Normale','','template')`,
            [
              randomUUID(),
              owner,
              b.projectId,
              title,
              a?.name ?? "",
              a?.email ?? null,
            ],
          );
        for (const label of spec.checks) {
          const id = randomUUID();
          await c.query(
            `INSERT INTO studio_delivery(id,owner_id,project_id,label,assignee_email) VALUES($1,$2,$3,$4,$5)`,
            [id, owner, b.projectId, label, a?.email ?? null],
          );
          await c.query(
            `INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,'delivery',1,$3,$4)`,
            [
              id,
              owner,
              JSON.stringify({
                label,
                done: false,
                required: true,
                template: b.template,
              }),
              actor,
            ],
          );
        }
        for (const kind of ["track", "live"] as const) {
          if (!spec[kind === "track" ? "tracks" : "live"]) continue;
          const count = await c.query(
            "SELECT id FROM studio_production WHERE owner_id=$1 AND project_id=$2 AND kind=$3 LIMIT 1",
            [owner, b.projectId, kind],
          );
          if (count.rows[0]) continue;
          for (let i = 0; i < (kind === "track" ? b.trackCount : 1); i++) {
            const id = randomUUID(),
              d = {
                ...emptyProduction(kind, b.projectId),
                title:
                  kind === "track"
                    ? "Brano " + String(i + 1).padStart(2, "0")
                    : "Show · " + p.rows[0].title,
                assignee: a?.name ?? "",
                assigneeEmail: a?.email ?? null,
              };
            await c.query(
              `INSERT INTO studio_production(id,owner_id,project_id,kind,data,request_digest) VALUES($1,$2,$3,$4,$5,'template')`,
              [id, owner, b.projectId, kind, JSON.stringify(d)],
            );
            await c.query(
              `INSERT INTO studio_production_history(item_id,owner_id,version,data,actor) VALUES($1,$2,1,$3,$4)`,
              [id, owner, JSON.stringify(d), actor],
            );
          }
        }
      }
      await c.query(
        `INSERT INTO studio_workflow(project_id,owner_id,template,planned_minutes) VALUES($1,$2,$3,$4) ON CONFLICT(project_id) DO UPDATE SET planned_minutes=$4,template=COALESCE(studio_workflow.template,$3),version=studio_workflow.version+1,updated_at=now()`,
        [
          b.projectId,
          owner,
          b.action === "template" ? b.template : null,
          b.plannedMinutes,
        ],
      );
      await c.query(
        `INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,'plan',$3,$4,$5)`,
        [
          b.projectId,
          owner,
          (old.rows[0]?.version ?? 0) + 1,
          JSON.stringify({
            template:
              b.action === "template" ? b.template : old.rows[0]?.template,
            plannedMinutes: b.plannedMinutes,
          }),
          actor,
        ],
      );
    } else throw new WorkInputError("Operazione non valida.");
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    if (e instanceof Error && e.message === "ASSIGNEE_INVALID")
      throw new WorkInputError("Seleziona una persona abilitata del team.");
    throw e;
  } finally {
    c.release();
  }
}
