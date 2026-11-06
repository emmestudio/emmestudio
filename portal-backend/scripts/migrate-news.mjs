import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
if(process.env.VERCEL_PROJECT_ID!=='prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK'||process.env.VERCEL_ENV!=='production')throw Error('NEWS_MIGRATION_WRONG_PROJECT');
const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
try{await pool.query(await readFile(new URL('../db/013-news.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('../db/014-news-hd-covers.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('../db/028-label-catalog.sql',import.meta.url),'utf8'));
const legacy=JSON.parse(await readFile(new URL('../db/label-moody-seed.json',import.meta.url),'utf8'));
await pool.query(`INSERT INTO studio_label_catalog(owner_id,kind,slug,data,published,published_once)
 SELECT id,'artist','moody',$2::jsonb,true,true FROM "user" WHERE lower(email)=lower($1) AND "emailVerified"=true
 ON CONFLICT(owner_id,kind,slug) DO NOTHING`,[process.env.PORTAL_OWNER_EMAIL,JSON.stringify(legacy)]);
console.log('NEWS_SCHEMA_READY');}finally{await pool.end();}
