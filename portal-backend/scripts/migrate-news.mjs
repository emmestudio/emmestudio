import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
if(process.env.VERCEL_PROJECT_ID!=='prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK'||process.env.VERCEL_ENV!=='production')throw Error('NEWS_MIGRATION_WRONG_PROJECT');
const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
try{await pool.query(await readFile(new URL('../db/013-news.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('../db/014-news-hd-covers.sql',import.meta.url),'utf8'));await pool.query(await readFile(new URL('../db/028-label-catalog.sql',import.meta.url),'utf8'));
await pool.query(await readFile(new URL('../db/029-label-catalog-order.sql',import.meta.url),'utf8'));
const legacy=JSON.parse(await readFile(new URL('../db/label-moody-seed.json',import.meta.url),'utf8'));
await pool.query(`WITH first_setup AS (
 INSERT INTO studio_label_catalog_seeded(owner_id)
 SELECT id FROM "user" WHERE lower(email)=lower($1) AND "emailVerified"=true
 ON CONFLICT DO NOTHING RETURNING owner_id
)
INSERT INTO studio_label_catalog(owner_id,kind,slug,data,published,published_once,sort_order)
 SELECT f.owner_id,'artist','moody',$2::jsonb,true,true,
   (SELECT COALESCE(MAX(sort_order),0)+1 FROM studio_label_catalog WHERE owner_id=f.owner_id AND kind='artist')
 FROM first_setup f
 ON CONFLICT(owner_id,kind,slug) DO NOTHING`,[process.env.PORTAL_OWNER_EMAIL,JSON.stringify(legacy)]);
console.log('NEWS_SCHEMA_READY');}finally{await pool.end();}
