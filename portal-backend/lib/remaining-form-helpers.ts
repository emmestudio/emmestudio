import type {FormDefinition,FormField} from './form-templates';
import {contractParties} from './additional-form-templates';
export const f=(key:string,label:string,required=true,type?:FormField['type'],options?:string[]):FormField=>({key,label,required,type,...(options?{options}:{})});
export const txt=(key:string,label:string,required=true)=>f(key,label,required,'textarea');
export const sel=(key:string,label:string,options:string[],required=true)=>f(key,label,required,'select',options);
export const dates=()=>[f('termStart','Decorrenza',true,'date'),f('termEnd','Scadenza',true,'date')];
export const contact=()=>[f('clientName','Nome e cognome / referente'),f('email','Email del referente',true,'email'),f('artistName','Artista / progetto')];
export const masters=()=>[f('title','Titolo / registrazione'),f('version','Versione / file identificato'),f('isrc','ISRC, se assegnato',false),txt('reference','Riferimento al materiale o allegato')];
export const owners=()=>[f('name','Nome / denominazione del titolare'),f('taxCode','Identificativo fiscale del titolare'),f('email','Email',true,'email'),f('share','Quota di proprietà del master (%)'),sel('capacity','Sottoscrittore',['Persona fisica maggiorenne','Organizzazione rappresentata','Minorenne rappresentato']),txt('representative','Se rappresentato: nome, identificativo e titolo alla firma',false)];
export function model(meta:Pick<FormDefinition,'id'|'slug'|'title'|'category'|'brand'|'description'>&Partial<Pick<FormDefinition,'contract'|'authorization'|'notice'|'signatures'|'minRows'|'rowLabel'>>,fields:FormField[],rowTitle:string,columns:FormField[],notes:string[]):FormDefinition{
 const contract=meta.contract!==false;
 return {...meta,contract,fields:[...(contract?contractParties():[]),...fields],rowTitle,columns,minRows:meta.minRows??(columns.length?1:0),signatures:meta.signatures||'parties',notes:[...notes,...(meta.notice?[]:[contract?'Verifica e sottoscrizione. Le condizioni devono essere personalizzate e verificate con un professionista prima dell’uso. La preparazione nel portale non firma accordi, non attesta pagamenti, non modifica contabilità, account o pubblicazioni. Le firme sono apposte di persona sul documento completo; restano salve le disposizioni inderogabili applicabili.':'Ambito del documento. La compilazione organizza le informazioni e non esegue firme, pagamenti, invii, trasferimenti o pubblicazioni. Le verifiche e gli atti eventualmente necessari sono effettuati separatamente.'])]};
}
