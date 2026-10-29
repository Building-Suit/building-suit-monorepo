import assert from 'node:assert/strict'
import { readFileSync,writeFileSync,existsSync,mkdirSync } from 'node:fs'
import path from 'node:path'
const root=process.cwd()
const {browserContext}=await import(path.join(root,'apps/ledger-suit/scripts/native-browser-runtime.mjs'))
const c=browserContext();const directory=path.join(root,'.local/verification/journal-precision')
mkdirSync(directory,{recursive:true,mode:0o700})
const api='http://127.0.0.1:61021'
const signed=await fetch(api+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:c.credentials.anon,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@alpha.test',password:'ledgersuit'})})
assert.equal(signed.status,200);const {access_token:token}=await signed.json()
const headers={apikey:c.credentials.anon,Authorization:'Bearer '+token,'Content-Type':'application/json'}
const organization=c.sql("select organization_id from public.organization_members where user_id='a0000000-0000-4000-8000-000000000001' order by organization_id limit 1;")
async function rpc(name,args){const r=await fetch(api+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify({p_organization_id:organization,...args})});assert.equal(r.status,200,name+' '+await r.clone().text());return r.json()}
const fixtureFile=path.join(directory,'fixture.json')
let fixture
if(existsSync(fixtureFile))fixture=JSON.parse(readFileSync(fixtureFile))
else {
 const bank=await rpc('create_account',{p_name:'LS-FIN-PRECISION-002 bank',p_type:'asset',p_subtype:'bank'})
 const equity=await rpc('create_account',{p_name:'LS-FIN-PRECISION-002 equity',p_type:'equity',p_subtype:'other_equity'})
 const journal=await rpc('create_adjustment',{p_transaction_date:'2026-10-18',p_description:'LS-FIN-PRECISION-002 exact huge journal',p_reason:'Retained owned native exact-money regression',p_lines:[{account_id:bank,side:'debit',amount_minor:'9007199254740993'},{account_id:equity,side:'credit',amount_minor:'9007199254740993'}]})
 fixture={task:'LS-FIN-PRECISION-002',organization,bank,equity,journal,expected_minor:'9007199254740993',description:'LS-FIN-PRECISION-002 exact huge journal'}
 writeFileSync(fixtureFile,JSON.stringify(fixture,null,2)+'\n',{mode:0o600,flag:'wx'})
}
const response=await fetch(api+'/rest/v1/rpc/search_transactions',{method:'POST',headers,body:JSON.stringify({p_organization_id:organization,p_account_ids:[fixture.bank]})})
assert.equal(response.status,200)
const raw=await response.text();const [row]=JSON.parse(raw)
assert.ok(raw.includes('9007199254740993'))
assert.equal(String(row.debit_minor),'9007199254740992')
const state={phase:'old_native_transport',expected_minor:fixture.expected_minor,parsed_minor:String(row.debit_minor),stored_minor:c.sql("select amount_minor::text from public.transaction_entries where transaction_id='"+fixture.journal+"' order by entry_index limit 1;"),row_type:typeof row.debit_minor,original_numeric_contract_preserved:true}
writeFileSync(path.join(directory,'old-transport.json'),JSON.stringify(state,null,2)+'\n',{mode:0o600})
console.log(JSON.stringify(state))

const assets=c.sql("select coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end),0)::text from public.transaction_entries e join public.accounts a on a.id=e.account_id where e.organization_id='"+fixture.organization+"' and a.type='asset';")
fixture.expected_assets_minor=assets
fixture.expected_assets_display=new Intl.NumberFormat('en-US').format(BigInt(assets)/100n)+'.'+(BigInt(assets)%100n).toString().padStart(2,'0')
writeFileSync(fixtureFile,JSON.stringify(fixture,null,2)+'\n',{mode:0o600})
