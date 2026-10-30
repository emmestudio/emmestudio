import 'server-only';
import type {AgreementProvider} from './service-agreement-data';
export function agreementProvider():AgreementProvider{try{const p=JSON.parse(process.env.STUDIO_CONTRACT_PROVIDER||'{}');return {name:String(p.name||'Marcello Lachina'),taxCode:String(p.taxCode||''),address:String(p.address||''),email:String(p.email||'')};}catch{throw Error('Anagrafica del contraente non disponibile.');}}
