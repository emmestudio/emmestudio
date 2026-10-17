type Line={description:string;quantity:number;unitPrice:number};
type QuotePdf={title:string;artist:string;service:string;id:string;version:number;status:string;amount:number;notes:string;items:Line[]};
const esc=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ").replace(/[()\\]/g,c=>"\\"+c).slice(0,240);
const eur=(c:number)=>(c/100).toFixed(2)+" EUR";
export function renderQuotePdf(q:QuotePdf):Buffer{
 const lines:{font:"F1"|"F2";size:number;x:number;y:number;text:string}[][]=[];
 let current:typeof lines[number]=[],y=738;
 const next=()=>{if(current.length)lines.push(current);current=[];y=738;};
 const put=(text:string,size=11,bold=false,indent=0)=>{if(y<90)next();current.push({font:bold?"F2":"F1",size,x:58+indent,y,text:esc(text)});y-=size+9;};
 const short=(s:string,width=83)=>{const tokens=s.split(/\s+/);const out:string[]=[];let x="";for(const t of tokens){if((x+" "+t).trim().length>width){if(x)out.push(x);x=t;}else x=(x+" "+t).trim()}if(x)out.push(x);return out.slice(0,150);};
 put("EMME STUDIO",22,true);put("PROPOSTA DI LAVORO  /  PREVENTIVO",11,true);y-=15;
 put(q.title,17,true);put("Artista: "+q.artist,11);put("Servizio: "+q.service,11);
 put("Riferimento: "+q.id.slice(0,8).toUpperCase()+"   |   Versione: "+q.version+"   |   Stato: "+q.status,10);
 y-=16;put("DETTAGLIO ECONOMICO",12,true);y-=8;
 if(q.items.length){
  q.items.slice(0,100).forEach((item,index)=>{
   for(const [i,line] of short((index+1)+". "+item.description,69).entries())put(line,10,i===0,0);
   put("Quantita: "+(item.quantity/100).toFixed(2)+"    Tariffa: "+eur(item.unitPrice)+"    Totale: "+eur(Math.round(item.quantity*item.unitPrice/100)),10,false,12);
  });
 }else put(q.service+"  -  "+eur(q.amount),11);
 y-=10;put("TOTALE PREVENTIVO: "+eur(q.amount),14,true);
 y-=18;put("CONDIZIONI E NOTE",12,true);
 for(const para of q.notes.split(/\r?\n/).slice(0,100)){for(const ln of short(para||" ",88))put(ln,10);}
 next();
 const objects:string[]=[];
 const add=(x:string)=>{objects.push(x);return objects.length};
 const font1=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
 const font2=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
 const pagesId=add("");
 const pageIds:number[]=[];
 for(const page of lines){
  const commands=['0.09 0.10 0.13 rg','0 0 595 842 re f','0.85 0.70 0.44 rg','45 785 505 1.5 re f'];
  for(const line of page){commands.push(line.font==="F2"?"0.93 0.86 0.73 rg":"0.87 0.87 0.88 rg");commands.push("BT /"+line.font+" "+line.size+" Tf "+line.x+" "+line.y+" Td ("+line.text+") Tj ET");}
  commands.push('0.85 0.70 0.44 rg','45 52 505 1 re f','0.7 0.7 0.7 rg','BT /F1 9 Tf 58 35 Td (EMME STUDIO  -  MUSIC PRODUCTION) Tj ET');
  const stream=commands.join("\n");
  const contentId=add("<< /Length "+Buffer.byteLength(stream,"latin1")+" >>\nstream\n"+stream+"\nendstream");
  const id=add("<< /Type /Page /Parent "+pagesId+" 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 "+font1+" 0 R /F2 "+font2+" 0 R >> >> /Contents "+contentId+" 0 R >>");
  pageIds.push(id);
 }
 objects[pagesId-1]="<< /Type /Pages /Kids ["+pageIds.map(id=>id+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
 const root=add("<< /Type /Catalog /Pages "+pagesId+" 0 R >>");
 let output="%PDF-1.4\n";const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(output,"latin1"));output+=(i+1)+" 0 obj\n"+objects[i]+"\nendobj\n";}
 const offset=Buffer.byteLength(output,"latin1");output+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
 for(const n of offsets.slice(1))output+=String(n).padStart(10,"0")+" 00000 n \n";
 output+="trailer\n<< /Size "+(objects.length+1)+" /Root "+root+" 0 R >>\nstartxref\n"+offset+"\n%%EOF";
 return Buffer.from(output,"latin1");
}
