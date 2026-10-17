import "server-only";
export const ARUBA_MAIL = {
 address:"mixmasterinfo@emmestudioproduction.it",
 imap:{host:"imaps.aruba.it",port:993,tls:true},
 smtp:{host:"smtps.aruba.it",port:465,tls:true}
} as const;
/** Configuration readiness only. Never return passwords or credentials to the browser. */
export function arubaMailReadiness(){
 const user=process.env.ARUBA_MAIL_USERNAME?.trim().toLowerCase();
 const password=process.env.ARUBA_MAIL_PASSWORD;
 return {
  address:ARUBA_MAIL.address,
  configured:user===ARUBA_MAIL.address&&Boolean(password),
  needsCredentials:user!==ARUBA_MAIL.address||!password
 };
}
