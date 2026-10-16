import "server-only";
/** Preview environments must never fall back to the production DATABASE_URL. */
export function databaseConnectionString(env:NodeJS.ProcessEnv=process.env):string{
 if(env.VERCEL_ENV==="preview"){
  if(env.VERCEL_GIT_COMMIT_REF!=="feature/posta-e-consegne-economiche")throw new Error("PREVIEW_BRANCH_NOT_AUTHORIZED");
  if(!env.STAGING_DATABASE_URL?.trim())throw new Error("STAGING_DATABASE_NOT_CONFIGURED");
  return env.STAGING_DATABASE_URL;
 }
 if(!env.DATABASE_URL?.trim())throw new Error("DATABASE_NOT_CONFIGURED");
 return env.DATABASE_URL;
}
