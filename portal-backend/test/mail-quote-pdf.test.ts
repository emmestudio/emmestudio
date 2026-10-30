import {test} from "node:test";
import assert from "node:assert/strict";
import {renderQuotePdf} from "../lib/mail-quote-pdf.ts";
test("quote PDF contains a correct header, trailer and one or more pages",()=>{
 const pdf=renderQuotePdf({title:"Produzione brano",artist:"Artista Test",service:"Mix e Master",id:"12345678-1234-1234-1234-123456789012",version:2,status:"Bozza",amount:25000,notes:"Condizioni concordate.",items:[{description:"Mix",quantity:100,unitPrice:15000},{description:"Master",quantity:100,unitPrice:10000}]});
 const str=pdf.toString("latin1");
 assert.ok(str.startsWith("%PDF-1.4"));
 assert.ok(str.endsWith("%%EOF"));
 assert.match(str,/\/Type \/Catalog/);
 assert.match(str,/250,00 EUR/);
 assert.match(str,/xref\n0 \d+/);
 assert.ok(pdf.length>500);
});
test("multi-page quote PDF includes multiple pages",()=>{
 const pdf=renderQuotePdf({title:"Produzione",artist:"Gruppo",service:"Album",id:"12345678-1234-1234-1234-123456789012",version:1,status:"Bozza",amount:1000,notes:"Note",items:Array.from({length:55},(_,i)=>({description:"Registrazione e editing traccia "+i,quantity:100,unitPrice:100}))});
 const str=pdf.toString("latin1");
 assert.match(str,/\/Count [2-9]/);
});
