type Artist={slug:string;name:string;published:boolean;photo?:string;page?:string;tagline?:string;links?:{url:string}[]};
function samePage(a:string,b:string){try{const x=new URL(a,'https://emmestudioproduction.it/'),y=new URL(b,'https://emmestudioproduction.it/');return x.hostname.replace(/^www\./,'')===y.hostname.replace(/^www\./,'')&&x.pathname===y.pathname&&x.searchParams.get('artista')===y.searchParams.get('artista');}catch{return false;}}
async function findArtist(url:string):Promise<Artist|undefined>{
 try{const u=new URL(url);if(!['emmestudioproduction.it','www.emmestudioproduction.it','open.spotify.com'].includes(u.hostname))return;
 const response=await fetch('https://emmestudioproduction.it/label-artists.json',{next:{revalidate:300},signal:AbortSignal.timeout(3000)});if(!response.ok)return;
 const list=await response.json() as Artist[];if(!Array.isArray(list))return;
 return list.find(a=>a.published&&(samePage(url,a.page||'label-'+a.slug+'.html')||(u.pathname==='/label-artista.html'&&u.searchParams.get('artista')===a.slug)||a.links?.some(l=>samePage(url,l.url))));
 }catch{return;}
}
export default async function RelatedContent({url,label}:{url:string;label:string}){
 const parsed=new URL(url);const internal=parsed.hostname.replace(/^www\./,'')==='emmestudioproduction.it';const match=internal?parsed.pathname.match(/^\/label-([a-z0-9-]+)\.html$/):null;
 const artist=await findArtist(url)||(match&&match[1]!=='artista'?{slug:match[1],name:label,published:true,page:parsed.pathname.slice(1)} as Artist:undefined);
 const artistPage=artist?'https://emmestudioproduction.it/'+(artist.page||'label-'+artist.slug+'.html'):url;
 return <a className={'news-related-card '+(artist?'news-related-artist':'')} href={artistPage} {...(!internal&&!artist?{target:'_blank',rel:'noopener noreferrer'}:{})}>
  {artist?.photo&&/^assets\/[a-zA-Z0-9_./-]+$/.test(artist.photo)?<img className="news-related-photo" src={'https://emmestudioproduction.it/'+artist.photo} alt={artist.name} width="140" height="140" loading="lazy"/>:<span className="news-related-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/></svg></span>}
  <span className="news-related-copy"><span className="news-small-label">{artist?'L’ARTISTA DI QUESTA NEWS':'APPROFONDISCI LA NOTIZIA'}</span><strong>{artist?.name||label}</strong><span className="news-related-description">{artist?'Biografia, musica e tutti i suoi collegamenti.':'Scopri il contenuto collegato a questo articolo.'}</span><span className="news-related-cta">{artist?'Scopri l’artista':'Apri '+label}</span></span><span className="news-action-arrow" aria-hidden="true"/>
 </a>;
}
