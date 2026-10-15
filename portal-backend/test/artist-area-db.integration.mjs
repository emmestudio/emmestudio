import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
const db=new PGlite();
try {
 for(const name of ["013-artist-previews.sql","014-artist-access.sql","015-artist-deliveries.sql"])
   await db.exec(await readFile("migrations/"+name,"utf8"));
 const owner="studio-owner",a=randomUUID(),b=randomUUID(),trackA=randomUUID(),trackB=randomUUID(),preA=randomUUID(),preB=randomUUID(),delA=randomUUID();
 await db.query("INSERT INTO studio_artist_access(owner_id,artist_id,email,enabled) VALUES ($1,$2,$3,true),($1,$4,$5,false)",
   [owner,a,"artist-a@example.com",b,"artist-b@example.com"]);
 let r=await db.query("SELECT artist_id FROM studio_artist_access WHERE owner_id=$1 AND lower(email)=$2 AND enabled=true",[owner,"artist-b@example.com"]);
 assert.equal(r.rowCount,0,"Disabled account denied");
 await db.query("UPDATE studio_artist_access SET enabled=true WHERE owner_id=$1 AND artist_id=$2",[owner,b]);
 r=await db.query("SELECT artist_id FROM studio_artist_access WHERE owner_id=$1 AND lower(email)=$2 AND enabled=true",[owner,"artist-b@example.com"]);
 assert.equal(r.rows[0].artist_id,b);
 await db.query("UPDATE studio_artist_access SET enabled=false WHERE owner_id=$1 AND artist_id=$2",[owner,b]);
 r=await db.query("SELECT artist_id FROM studio_artist_access WHERE owner_id=$1 AND lower(email)=$2 AND enabled=true",[owner,"artist-b@example.com"]);
 assert.equal(r.rowCount,0,"Revocation applies to new lookups");
 await db.query("INSERT INTO studio_artist_previews(id,owner_id,artist_id,track_id,title,drive_file_id,version_label,status) VALUES ($1,$2,$3,$4,'mix','previewfile1','v1','ready'),($5,$2,$6,$7,'mix','previewfile2','v1','draft')",
   [preA,owner,a,trackA,preB,b,trackB]);
 r=await db.query("SELECT id FROM studio_artist_previews WHERE owner_id=$1 AND artist_id=$2 AND status IN ('ready','approved','revision_requested')",[owner,a]);
 assert.deepEqual(r.rows.map(x=>x.id),[preA]);
 r=await db.query("SELECT id FROM studio_artist_previews WHERE owner_id=$1 AND artist_id=$2 AND status IN ('ready','approved','revision_requested')",[owner,b]);
 assert.equal(r.rowCount,0,"Draft not shared");
 await db.query("UPDATE studio_artist_previews SET status='ready' WHERE id=$1",[preB]);
 r=await db.query("SELECT id FROM studio_artist_previews WHERE owner_id=$1 AND artist_id=$2 AND status='ready'",[owner,a]);
 assert.deepEqual(r.rows.map(x=>x.id),[preA],"Other artist preview not leaked");
 await db.query("INSERT INTO studio_artist_deliveries(id,owner_id,artist_id,track_id,title,file_id,file_name) VALUES ($1,$2,$3,$4,'Master','finalfile1','final.wav')",[delA,owner,a,trackA]);
 r=await db.query("SELECT id FROM studio_artist_deliveries WHERE owner_id=$1 AND artist_id=$2 AND enabled=true",[owner,a]);
 assert.equal(r.rowCount,0,"Deliveries default disabled");
 await db.query("UPDATE studio_artist_deliveries SET enabled=true WHERE id=$1 AND owner_id=$2",[delA,owner]);
 r=await db.query("SELECT id FROM studio_artist_deliveries WHERE owner_id=$1 AND artist_id=$2 AND enabled=true",[owner,b]);
 assert.equal(r.rowCount,0,"Other artist cannot get delivery");
 await db.query("UPDATE studio_artist_deliveries SET enabled=false WHERE id=$1 AND owner_id=$2",[delA,owner]);
 r=await db.query("SELECT id FROM studio_artist_deliveries WHERE owner_id=$1 AND artist_id=$2 AND enabled=true",[owner,a]);
 assert.equal(r.rowCount,0,"Revoked delivery inaccessible");
 console.log("PASS: migrations, account enable/revoke, preview isolation, draft restriction, delivery release/revoke");
}finally{await db.close();}
