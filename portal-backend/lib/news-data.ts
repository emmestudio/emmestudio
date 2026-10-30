export const newsCategories=['Studio','Label','Uscite','Live'] as const;
export type NewsCategory=typeof newsCategories[number];
export type NewsInput={title:string;slug:string;excerpt:string;category:NewsCategory;body:string;status:'draft'|'published';featured:boolean;publication_date:string;related_label:string;related_url:string;media_url?:string};
export function validateNews(value:unknown):NewsInput {
 if(!value||typeof value!=='object')throw Error('Dati non validi.');
 const v=value as Record<string,unknown>;
 const field=(key:string,max:number)=>{if(typeof v[key]!=='string'||(v[key] as string).length>max)throw Error('Campo non valido: '+key);return (v[key] as string).trim();};
 const title=field('title',180),slug=field('slug',120),excerpt=field('excerpt',400),body=field('body',40000),publication_date=field('publication_date',10),related_label=field('related_label',100),related_url=field('related_url',1500);
 if(!title||!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Inserisci titolo e indirizzo con lettere minuscole, numeri e trattini.');
 if(!newsCategories.includes(v.category as NewsCategory)||!['draft','published'].includes(String(v.status)))throw Error('Categoria o stato non valido.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(publication_date)||new Date(publication_date+'T12:00:00Z').toISOString().slice(0,10)!==publication_date)throw Error('Data non valida.');
 if(related_url){let url;try{url=new URL(related_url);}catch{throw Error('Collegamento non valido.');}if(url.protocol!=='https:'||url.username||url.password)throw Error('Usa un collegamento HTTPS.');if(!related_label)throw Error('Inserisci un nome per il collegamento.');}
 const media_url=typeof v.media_url==='string'?v.media_url.trim():'';if(media_url&&!mediaEmbed(media_url))throw Error('Inserisci un link Spotify o YouTube valido.');
 if(v.status==='published'&&(!excerpt||!body))throw Error('Per pubblicare servono descrizione e testo.');
 return {media_url,title,slug,excerpt,body,publication_date,related_label,related_url,category:v.category as NewsCategory,status:v.status as 'draft'|'published',featured:v.featured===true};
}
export function imageType(b:Uint8Array):string|null{
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';return null;
}

export function mediaEmbed(value:string):string|null{try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;const parts=u.pathname.split('/').filter(Boolean);if(u.hostname==='open.spotify.com'){if(parts[0]?.startsWith('intl-'))parts.shift();if(['track','album','playlist','artist'].includes(parts[0])&&/^[a-zA-Z0-9]{22}$/.test(parts[1]||'')&&parts.length===2)return 'https://open.spotify.com/embed/'+parts.join('/');}let id:string|null=null;if(['youtube.com','www.youtube.com'].includes(u.hostname)){if(u.pathname==='/watch')id=u.searchParams.get('v');else if(['shorts','embed'].includes(parts[0]))id=parts[1];}else if(u.hostname==='youtu.be')id=parts[0];if(id&&/^[a-zA-Z0-9_-]{11}$/.test(id))return 'https://www.youtube-nocookie.com/embed/'+id;return null;}catch{return null;}}
