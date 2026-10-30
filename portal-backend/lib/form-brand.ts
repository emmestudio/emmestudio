import {findFormTemplate} from './form-templates';
export type FormBrand='studio'|'label';
export const formBrandName=(brand:FormBrand)=>brand==='label'?'Emme Label':'Emme Studio';
export function formBrand(template:string,savedBrand?:unknown):FormBrand{if(savedBrand==='label'||savedBrand==='studio')return savedBrand;return findFormTemplate(template)?.brand||'studio';}
