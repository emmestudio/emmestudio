import 'server-only';
import {labelLogoOriginal} from './label-logo-asset';
import type {FormBrand} from './form-brand';
import {inflateSync} from 'node:zlib';
import sharp from 'sharp';
import {quoteLogo} from './quote-pdf-assets';
// Reuse the exact original logo pixels already embedded in the quote documents.
export async function documentLogo(brand:FormBrand='studio'){if(brand==='label'){const original=Buffer.from(labelLogoOriginal,'base64');const png=await sharp(original).trim({threshold:0}).png().toBuffer();return 'data:image/png;base64,'+png.toString('base64');}const rgb=inflateSync(Buffer.from(quoteLogo.rgb,'base64')),alpha=inflateSync(Buffer.from(quoteLogo.alpha,'base64')),rgba=Buffer.alloc(quoteLogo.width*quoteLogo.height*4);for(let i=0;i<alpha.length;i++){rgba[i*4]=rgb[i*3];rgba[i*4+1]=rgb[i*3+1];rgba[i*4+2]=rgb[i*3+2];rgba[i*4+3]=alpha[i];}const png=await sharp(rgba,{raw:{width:quoteLogo.width,height:quoteLogo.height,channels:4}}).png().toBuffer();return 'data:image/png;base64,'+png.toString('base64');}
