import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
if(process.env.VERCEL_PROJECT_ID!=='prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK'||process.env.VERCEL_ENV!=='production')throw Error('NEWS_MIGRATION_WRONG_PROJECT');
const pool=new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
try{await pool.query(await readFile(new URL('../db/013-news.sql',import.meta.url),'utf8'));console.log('NEWS_SCHEMA_READY');}finally{await pool.end();}
