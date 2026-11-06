import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";
import { ownerSession } from "@/lib/owner-session";
import { newsCoverResponse } from "@/lib/news-cover-response";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!validId(id)) return new Response(null, { status: 404 });
  try {
    const db = getDb();
    let row = (await db.query(
      `SELECT image,image_type FROM studio_label_catalog
       WHERE id=$1 AND published AND owner_id IN (SELECT id FROM "user" WHERE lower(email)=lower($2) AND "emailVerified"=true)`,
      [id, process.env.PORTAL_OWNER_EMAIL],
    )).rows[0];
    if (!row) {
      const owner = await ownerSession(request.headers);
      if (!owner) return new Response(null, { status: 404 });
      row = (await db.query("SELECT image,image_type FROM studio_label_catalog WHERE id=$1 AND owner_id=$2",
        [id, owner.user.id])).rows[0];
    }
    return row?.image ? newsCoverResponse(row.image, row.image_type, true) : new Response(null, { status: 404 });
  } catch { return new Response(null, { status: 503 }); }
}
