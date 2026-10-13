import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { configurationReady, ownerAllowed } from "./config";

let instance: ReturnType<typeof betterAuth> | undefined;

export function getAuth() {
  if (!configurationReady()) throw new Error("PORTAL_NOT_CONFIGURED");
  if (instance) return instance;
  const options: BetterAuthOptions = {
    appName: "Emme Studio Portal",
    baseURL: process.env.BETTER_AUTH_URL!,
    secret: process.env.BETTER_AUTH_SECRET!,
    database: new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }),
    emailAndPassword: { enabled: false },
    account: { encryptOAuthTokens: true },
    rateLimit: { enabled: true, storage: "database" },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        prompt: "select_account consent",
        accessType: "offline"
      }
    },
    databaseHooks: {
      user: { create: { before: async user => {
        if (!ownerAllowed(user.email, user.emailVerified)) throw new APIError("FORBIDDEN", { message: "Accesso riservato all'amministratore dello studio." });
        return { data: user };
      } } },
      session: { create: { before: async session => {
        // Re-check every login, including accounts already registered.
        const ctx = await instance!.$context;
        const user = await ctx.internalAdapter.findUserById(session.userId);
        if (!user || !ownerAllowed(user.email, user.emailVerified)) throw new APIError("FORBIDDEN", { message: "Accesso non abilitato." });
        return { data: session };
      } } }
    },
    plugins: [nextCookies()]
  };
  const created = betterAuth(options);
  instance = created;
  return created;
}
