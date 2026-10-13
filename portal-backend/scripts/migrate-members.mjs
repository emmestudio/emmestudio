import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
if (process.env.VERCEL_PROJECT_ID !== 'prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK' || process.env.VERCEL_ENV !== 'production' || process.env.BETTER_AUTH_URL !== 'https://emme-studio-portale.vercel.app') throw new Error('MIGRATION_WRONG_PROJECT');
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15000 });
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(187346211)');
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    const allowed = new Set(['user','session','account','verification','rateLimit','studio_calendar','studio_projects','studio_tasks','portal_members']);
    if (!tables.rows.some(row => row.tablename === 'studio_tasks') || tables.rows.some(row => !allowed.has(row.tablename))) throw new Error('MIGRATION_UNEXPECTED_DATABASE');
    await client.query(await readFile(new URL('../db/004-members.sql', import.meta.url), 'utf8')); await client.query('COMMIT');
    console.log('EMME_MEMBERS_SCHEMA_READY: no accounts enabled automatically.');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
} catch (error) { console.error('MEMBERS_MIGRATION_FAILED:', error.message?.startsWith('MIGRATION_') ? error.message : (error.code || 'DATABASE_ERROR')); process.exitCode = 1; }
finally { await pool.end(); }
