import {Pool} from 'pg';
import {createHash} from 'node:crypto';
if(process.argv[2]!=='--reset-confirmed-test-finances-20261014'||Date.now()>1792005578869||process.env.VERCEL_PROJECT_ID!=='prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK'||process.env.VERCEL_ENV!=='production'||process.env.PORTAL_OWNER_EMAIL!=='emmestudio.mixinfo@gmail.com'||process.env.BETTER_AUTH_URL!=='https://emme-studio-portale.vercel.app')throw Error('RESET_SCOPE_INVALID');
const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL,max:1});
try{
const c=await pool.connect();
try{
await c.query('BEGIN');
await c.query("SET LOCAL lock_timeout='15s'");
const allowed=['user','session','account','verification','rateLimit','studio_calendar','studio_projects','studio_tasks','portal_members','studio_artists','studio_quotes','studio_installments','studio_payments','studio_production','studio_production_history','studio_quote_history','studio_costs','studio_cost_history','studio_workflow','studio_hours','studio_delivery','studio_work_history'];
const tables=(await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(r=>r.tablename);
if(tables.some(t=>!allowed.includes(t))||!tables.includes('studio_quotes'))throw Error('RESET_UNEXPECTED_DATABASE');
await c.query('LOCK TABLE '+allowed.filter(t=>tables.includes(t)).map(t=>'"'+t+'"').join(',')+' IN SHARE ROW EXCLUSIVE MODE');
const owners=(await c.query('SELECT id FROM "user" WHERE lower(email)=$1 AND "emailVerified"=true',[process.env.PORTAL_OWNER_EMAIL])).rows;
if(owners.length!==1)throw Error('RESET_OWNER_INVALID');
const owner=owners[0].id;
const target=['studio_payments','studio_installments','studio_quote_history','studio_quotes'];
const preserved=allowed.filter(t=>tables.includes(t)&&!target.includes(t));
async function fingerprints(){const out={};for(const t of preserved){const rows=(await c.query('SELECT to_jsonb(t)::text AS row FROM "'+t+'" t ORDER BY to_jsonb(t)::text')).rows;out[t]=createHash('sha256').update(JSON.stringify(rows)).digest('hex');}return JSON.stringify(out);}
const before=await fingerprints();const counts={};
for(const t of target)counts[t]=(await c.query('DELETE FROM "'+t+'" WHERE owner_id=$1',[owner])).rowCount;
for(const t of target)if(Number((await c.query('SELECT count(*) FROM "'+t+'" WHERE owner_id=$1',[owner])).rows[0].count)!==0)throw Error('RESET_NOT_EMPTY');
if(before!==await fingerprints())throw Error('RESET_PRESERVATION_FAILED');
await c.query('COMMIT');
console.log('EMME_TEST_FINANCES_RESET_VERIFIED '+JSON.stringify(counts)+'; all other tables unchanged.');
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){console.error('RESET_FAILED',e.message?.startsWith('RESET_')?e.message:e.code||'DB_ERROR');process.exitCode=1;}finally{await pool.end();}
