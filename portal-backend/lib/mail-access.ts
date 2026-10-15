import "server-only";
import {workspaceSession} from "./workspace-session";
export async function ownerMailboxSession(headers:Headers){
 const session=await workspaceSession(headers);
 if(!session||session.role!=="admin"||session.user.id!==session.workspaceOwnerId)return null;
 return session;
}
// Future team access must use explicit per-account grants with separate
// view/send/manage permissions. Never inherit access from generic admin roles.
