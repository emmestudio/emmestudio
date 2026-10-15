import {headers} from "next/headers";
import {redirect} from "next/navigation";
import Link from "next/link";
import {ownerMailboxSession} from "@/lib/mail-access";
import {getDb} from "@/lib/db";
import MailWorkspace from "./workspace";
export const dynamic="force-dynamic";
export default async function Page(){
 const session=await ownerMailboxSession(await headers());
 if(!session)redirect("/accesso");
 let accounts:{id:string;provider:"aruba"|"gmail";address:string;status:string}[]=[];
 let migrationNeeded=false;
 try{
  const result=await getDb().query('SELECT id,provider,address,status FROM studio_mail_accounts WHERE owner_id=$1 ORDER BY provider,address',[session.workspaceOwnerId]);
  accounts=result.rows;
 }catch{migrationNeeded=true;}
 return <main className="shell dashboard">
  <span className="eyebrow">EMME STUDIO · GESTIONE RISERVATA</span>
  <h1>La tua <em>Posta.</em></h1>
  <p>Aruba e Gmail in un unico spazio, con identità di invio separate e accesso riservato al titolare.</p>
  <MailWorkspace accounts={accounts} migrationNeeded={migrationNeeded}/>
  <p className="small"><Link href="/dashboard">Torna alla dashboard</Link></p>
 </main>;
}
