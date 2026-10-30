type Props={src:string};
export default function Media({src}:Props){
 const spotify=src.startsWith('https://open.spotify.com/');
 return <section className={'news-media '+(spotify?'news-media-spotify':'news-media-youtube')} aria-label={spotify?'Ascolta il progetto':'Guarda il video'}>
  <div className="news-media-heading"><span className="news-platform-icon" aria-hidden="true"><img src={'https://emmestudioproduction.it/assets/social-outline/'+(spotify?'spotify':'youtube')+'.svg'} width="22" height="22" alt=""/></span><div><span className="news-small-label">{spotify?'SPOTIFY':'YOUTUBE'}</span><h2>{spotify?'Ascolta il progetto.':'Guarda il video.'}</h2></div></div>
  <iframe title={spotify?'Ascolta il progetto su Spotify':'Guarda il video su YouTube'} src={src} width="100%" height={spotify?352:440} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="eager"/>
 </section>;
}
