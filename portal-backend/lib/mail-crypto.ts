import "server-only";
import {createCipheriv,createDecipheriv,randomBytes,createHash} from "node:crypto";
function key(){
 const value=process.env.MAIL_TOKEN_ENCRYPTION_KEY;
 if(!value||!(/^[0-9a-f]{64}$/i.test(value)))throw Error("MAIL_TOKEN_ENCRYPTION_KEY must be 32-byte hex");
 return Buffer.from(value,"hex");
}
export function encryptMailSecret(plain:string){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(),iv);
 const encrypted=Buffer.concat([cipher.update(plain,"utf8"),cipher.final()]);
 return ["v1",iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
export function decryptMailSecret(input:string){
 const [version,iv,tag,encrypted]=input.split(".");
 if(version!=="v1"||!iv||!tag||!encrypted)throw Error("Invalid encrypted secret");
 const cipher=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));
 cipher.setAuthTag(Buffer.from(tag,"base64url"));
 return Buffer.concat([cipher.update(Buffer.from(encrypted,"base64url")),cipher.final()]).toString("utf8");
}
export function fingerprintMailAccount(accountId:string){return createHash("sha256").update(accountId).digest("hex").slice(0,16);}
