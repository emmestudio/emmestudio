import "server-only";
import {getAuth} from "./auth";
import {configurationReady} from "./config";
import {getDb} from "./db";
import {normalizeEmail} from "./access-policy";
export async function artistSession(headers:Headers) {
 if(!configurationReady())return null;
 const session=await getAuth().api.getSession({headers});
 if(!session?.user.emailVerified)return null;
 const r=await getDb().query(`SELECT x.owner_id,x.artist_id,a.name
   FROM studio_artist_access x
   JOIN "user" u ON u.id=x.owner_id
   JOIN studio_artists a ON a.id=x.artist_id AND a.owner_id=x.owner_id
   WHERE lower(x.email)=$1 AND x.enabled=true AND a.deleted_at IS NULL
   AND lower(u.email)=lower($2) AND u."emailVerified"=true LIMIT 1`,
   [normalizeEmail(session.user.email),process.env.PORTAL_OWNER_EMAIL]);
 const access=r.rows[0];
 return access?{user:session.user,ownerId:access.owner_id as string,artistId:access.artist_id as string,artistName:access.name as string}:null;
}
