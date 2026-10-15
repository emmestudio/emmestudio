import {headers} from "next/headers";
import {getAuth} from "@/lib/auth";
import {getDb} from "@/lib/db";
import {normalizedArtistEmail} from "@/lib/artist-access-policy";
export const dynamic="force-dynamic";
export async function GET(){
 try{
 const session=await getAuth().api.getSession({headers:await headers()});
 if(!session)return Response.json({session:"absent",hint:"Google non ha creato una sessione; verifica il callback OAuth."},{headers:{"Cache-Control":"no-store"}});
 const email=normalizedArtistEmail(session.user.email);
 const r=await getDb().query(`SELECT x.enabled,a.deleted_at IS NOT NULL AS deleted,u."emailVerified" AS owner_verified,
 lower(u.email)=lower($2) AS owner_matches
 FROM studio_artist_access x
 JOIN studio_artists a ON a.id=x.artist_id AND a.owner_id=x.owner_id
 JOIN "user" u ON u.id=x.owner_id
 WHERE lower(trim(x.email))=$1 LIMIT 1`,[email,process.env.PORTAL_OWNER_EMAIL]);
 const a=r.rows[0];
 return Response.json({session:"present",emailVerified:Boolean(session.user.emailVerified),artistRecord:Boolean(a),accessEnabled:Boolean(a?.enabled),artistDeleted:Boolean(a?.deleted),ownerVerified:Boolean(a?.owner_verified),ownerMatches:Boolean(a?.owner_matches)},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return Response.json({error:"diagnostic_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
