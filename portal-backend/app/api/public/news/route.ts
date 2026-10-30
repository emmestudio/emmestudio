import {publishedNews,coverUrl} from '@/lib/news';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const origin=request.headers.get('origin');const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin'};
 if(origin&&['https://emmestudioproduction.it','https://www.emmestudioproduction.it'].includes(origin))headers['Access-Control-Allow-Origin']=origin;
 try{const articles=(await publishedNews()).map(({body,...article})=>({...article,url:'https://portal.emmestudioproduction.it/news/'+article.slug,cover:article.has_cover?'https://portal.emmestudioproduction.it'+coverUrl(article.slug):null}));return Response.json({articles},{headers});}catch{console.error('PUBLIC_NEWS_FAILED');return Response.json({error:'Notizie temporaneamente non disponibili.'},{status:503,headers});}
}
