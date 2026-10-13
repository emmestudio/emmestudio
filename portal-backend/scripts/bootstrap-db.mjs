// Run once in the dedicated Vercel deployment environment, never in normal builds.
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';

const expectedProject = 'prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK';
const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'PORTAL_OWNER_EMAIL'];
if (process.env.VERCEL_PROJECT_ID !== expectedProject || process.env.VERCEL_ENV !== 'production') throw new Error('SETUP_PROJECT_OR_ENVIRONMENT_MISMATCH');
if (required.some(key => !process.env[key]?.trim())) throw new Error('SETUP_CONFIGURATION_INCOMPLETE');
if (process.env.BETTER_AUTH_URL !== 'https://emme-studio-portale.vercel.app') throw new Error('SETUP_ORIGIN_MISMATCH');

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
try {
  // Hold one connection during setup. Advisory lock prevents competing bootstrap runs.
  const guard = await pool.connect();
  await guard.query('SELECT pg_advisory_lock(187346207)');
  try {
    const tables = await guard.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    const allowed = new Set(['user', 'session', 'account', 'verification', 'rateLimit']);
    if (tables.rows.some(row => !allowed.has(row.tablename))) throw new Error('SETUP_DATABASE_NOT_EMPTY_OR_AUTH_ONLY');
    // Use a separate pool while holding the advisory lock.
    const migrationPool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
    try {
      const plan = await getMigrations({ database: migrationPool, rateLimit: { enabled: true, storage: 'database' }, account: { encryptOAuthTokens: true } });
      if (plan.unsafeChanges.length || plan.schemaProblems.length) throw new Error('SETUP_UNSAFE_MIGRATION');
      if (plan.toBeAdded.length) throw new Error('SETUP_EXISTING_SCHEMA_REQUIRES_REVIEW');
      console.log('Emme Studio auth setup: tables to create', plan.toBeCreated.map(table => table.table).join(', '));
      await plan.runMigrations();
      console.log('Emme Studio auth setup complete. No sample data inserted.');
    } finally { await migrationPool.end(); }
  } finally {
    await guard.query('SELECT pg_advisory_unlock(187346207)');
    guard.release();
  }
} catch (error) {
  // Never print connection strings, provider tokens or database error details.
  console.error('Emme Studio auth setup failed:', error.message?.startsWith('SETUP_') ? error.message : (error.code || 'DATABASE_SETUP_ERROR'));
  process.exitCode = 1;
} finally { await pool.end(); }
