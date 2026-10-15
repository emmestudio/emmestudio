import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {workspaceSession} from "@/lib/workspace-session";
import RetentionTest from "./retention-test";
export const dynamic="force-dynamic";
export default async function Page(){
 const s=await workspaceSession(await headers());
 if(!s||s.role!=="admin"||s.user.id!==s.workspaceOwnerId)redirect("/accesso");
 return <main className="shell dashboard"><RetentionTest/></main>;
}
