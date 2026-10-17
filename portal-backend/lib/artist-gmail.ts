import "server-only";
import {getDb} from "./db";
import {getAuth} from "./auth";
export const gmailSendScope="https://www.googleapis.com/auth/gmail.send";
export async function gmailPermission(owner:string){
 const r=await getDb().query('SELECT id,scope FROM account WHERE "userId"=$1 AND "providerId"=\'google\'',[owner]);
 const account=r.rows[0];
 return {account,granted:Boolean(account&&(account.scope??"").split(/[ ,]+/).includes(gmailSendScope))};
}
const base64url=(text:string)=>Buffer.from(text,"utf8").toString("base64url");
export async function sendArtistGmail(owner:string,to:string,subject:string,body:string){
 const {account,granted}=await gmailPermission(owner);
 if(!granted||!account) return {sent:false,reason:"gmail_authorization_required"} as const;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))return {sent:false,reason:"invalid_recipient"} as const;
 const token=await getAuth().api.getAccessToken({body:{accountId:account.id,userId:owner}});
 const raw=base64url(["To: "+to,"Subject: =?UTF-8?B?"+Buffer.from(subject,"utf8").toString("base64")+"?=","MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","",""+body].join("\r\n"));
 const response=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:"Bearer "+token.accessToken,"Content-Type":"application/json"},body:JSON.stringify({raw}),signal:AbortSignal.timeout(10000),cache:"no-store"});
 if(!response.ok)throw new Error("Gmail API "+response.status);
 return {sent:true} as const;
}
