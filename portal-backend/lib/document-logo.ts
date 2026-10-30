import 'server-only';
import {inflateSync} from 'node:zlib';
import sharp from 'sharp';
import {quoteLogo} from './quote-pdf-assets';
// Reuse the exact original logo pixels already embedded in the quote documents.
export async function documentLogo(){const rgb=inflateSync(Buffer.from(quoteLogo.rgb,'base64')),alpha=inflateSync(Buffer.from(quoteLogo.alpha,'base64')),rgba=Buffer.alloc(quoteLogo.width*quoteLogo.height*4);for(let i=0;i<alpha.length;i++){rgba[i*4]=rgb[i*3];rgba[i*4+1]=rgb[i*3+1];rgba[i*4+2]=rgb[i*3+2];rgba[i*4+3]=alpha[i];}const png=await sharp(rgba,{raw:{width:quoteLogo.width,height:quoteLogo.height,channels:4}}).png().toBuffer();return 'data:image/png;base64,'+png.toString('base64');}
