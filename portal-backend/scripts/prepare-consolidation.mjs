// Guarded release preparation: never access a database locally or in other projects.
if(process.env.VERCEL_ENV === 'production') {
 if(process.env.VERCEL_PROJECT_ID !== 'prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK')throw Error('MIGRATION_WRONG_PROJECT');
 const {Pool}=await import('pg');
 const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
 let ready=false;
 try{
  const r=await pool.query("SELECT pg_get_functiondef(to_regprocedure('public.studio_lock_artist_file()')) AS definition,to_regclass('public.studio_artist_email_outbox') AS outbox");
  ready=Boolean(r.rows[0]?.outbox&&/to_jsonb\(NEW\)/i.test(r.rows[0]?.definition||''));
 }finally{await pool.end();}
 if(!ready){await import('./migrate-consolidation.mjs');if(process.exitCode)throw Error('CONSOLIDATION_PREPARE_FAILED');}
 else console.log('EMME_CONSOLIDATION_ALREADY_READY');
}
