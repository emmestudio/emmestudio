import {ownerMailboxSession} from "@/lib/mail-access";
import {encryptMailSecret} from "@/lib/mail-crypto";
import {getDb} from "@/lib/db";
import {createHmac,timingSafeEqual} from "node:crypto";
export const runtime="nodejs";export const dynamic="force-dynamic";
function go(status:string){
 const url=new URL("/posta",process.env.BETTER_AUTH_URL!);
 url.searchParams.set("mail",status);
 const response=Response.redirect(url.toString(),303);
 response.headers.append("Set-Cookie","mail_oauth_nonce=; Path=/api/mail/google; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
 return response;
}
export async function GET(req:Request){
 const session=await ownerMailboxSession(req.headers);
 if(!session)return go("unauthorized");
 const url=new URL(req.url);
 const code=url.searchParams.get("code"),state=url.searchParams.get("state");
 if(!code||!state||code.length>4096||state.length>4000)return go("cancelled");
 const nonce=req.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith("mail_oauth_nonce="))?.slice(17);
 if(!nonce)return go("expired");
 const [raw,mac]=state.split(".");
 if(!raw||!mac)return go("invalid");
 const expected=createHmac("sha256",process.env.BETTER_AUTH_SECRET!).update(raw).digest("base64url");
 const a=Buffer.from(mac),b=Buffer.from(expected);
 if(a.length!==b.length||!timingSafeEqual(a,b))return go("invalid");
 let data:{id:string;owner:string;nonce:string;exp:number};
 try{data=JSON.parse(Buffer.from(raw,"base64url").toString());}catch{return go("invalid");}
 if(data.owner!==session.workspaceOwnerId||data.nonce!==nonce||data.exp<Date.now())return go("expired");
 try{
  const db=getDb();
  const found=await db.query("SELECT id,address FROM studio_mail_accounts WHERE id=$1 AND owner_id=$2 AND provider='gmail'",[data.id,data.owner]);
  if(!found.rowCount)return go("notfound");
  const redirectUri=new URL("/api/mail/google/callback",process.env.BETTER_AUTH_URL!).toString();
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:process.env.GMAIL_OAUTH_CLIENT_ID!,client_secret:process.env.GMAIL_OAUTH_CLIENT_SECRET!,redirect_uri:redirectUri,grant_type:"authorization_code"}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)return go("oautherror");
  const t=await response.json() as{access_token?:string;refresh_token?:string;scope?:string};
  if(!t.access_token||!t.refresh_token)return go("no_refresh");
  const identity=await fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+t.access_token},signal:AbortSignal.timeout(12000)});
  if(!identity.ok)return go("identityerror");
  const user=await identity.json() as{email?:string;email_verified?:boolean;sub?:string};
  if(!user.email_verified||!user.sub||user.email?.toLowerCase()!==String(found.rows[0].address).toLowerCase())return go("email_mismatch");
  const required=["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/gmail.send"];
  if(!required.every(scope=>t.scope?.split(" ").includes(scope)))return go("scopes");
  await db.query(`INSERT INTO studio_mail_google_credentials(account_id,owner_id,encrypted_refresh_token,google_subject,scopes)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(account_id) DO UPDATE SET
   encrypted_refresh_token=EXCLUDED.encrypted_refresh_token,google_subject=EXCLUDED.google_subject,scopes=EXCLUDED.scopes,updated_at=now()`,[data.id,data.owner,encryptMailSecret(t.refresh_token),user.sub,t.scope]);
  await db.query("UPDATE studio_mail_accounts SET status='connected',updated_at=now() WHERE id=$1 AND owner_id=$2",[data.id,data.owner]);
  return go("connected");
 }catch{return go("setup_error");}
}
