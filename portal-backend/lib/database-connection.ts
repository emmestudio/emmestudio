import "server-only";
/**
 * Mail preview explicitly shares Neon main with production.
 * Never allow other preview branches to use the production connection.
 */
export function databaseConnectionString(env:NodeJS.ProcessEnv=process.env):string{
 if(env.VERCEL_ENV==="preview" && env.VERCEL_GIT_COMMIT_REF!=="feature/posta-e-consegne-economiche")
  throw new Error("PREVIEW_BRANCH_NOT_AUTHORIZED");
 if(!env.DATABASE_URL?.trim())throw new Error("DATABASE_NOT_CONFIGURED");
 return env.DATABASE_URL;
}
