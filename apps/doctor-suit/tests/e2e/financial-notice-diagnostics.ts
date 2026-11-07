import type { Page,TestInfo } from '@playwright/test'
/** Fixed booleans and enum state only, captured before owned context cleanup. No DOM, IDs, Auth or RPC bodies. */
export async function financialNoticeDiagnostic(page:Page|undefined,info:TestInfo){
 if(!page||page.isClosed())return
 try{
  const snapshot=await page.evaluate(()=>{
   const root=document.querySelector('#__nuxt') as unknown as {__vue_app__?:{config?:{globalProperties?:{$nuxt?:{$doctorManualPayment?:{state?:{ready?:boolean;loading?:boolean;pending?:boolean;uncertain?:boolean;error?:string|null;selected?:unknown;items?:unknown[]};selected?:()=>unknown}}}}}}
   const controller=root?.__vue_app__?.config?.globalProperties?.$nuxt?.$doctorManualPayment,s=controller?.state
   return{controller_present:Boolean(controller),ready:s?.ready===true,loading:s?.loading===true,pending:s?.pending===true,uncertain:s?.uncertain===true,selected_present:Boolean(s?.selected),selected_resolves:Boolean(controller?.selected?.()),has_rows:Boolean(s?.items?.length),error:['denied','network','invalid','session','stale'].includes(String(s?.error))?String(s?.error):s?.error?'other':'none'}
  })
  info.annotations.push({type:'financial-notice-diagnostic',description:JSON.stringify(snapshot)})
 }catch{info.annotations.push({type:'financial-notice-diagnostic',description:JSON.stringify({capture_unavailable:true})})}
}
export async function financialBillingDiagnostic(page:Page|undefined,info:TestInfo,kind:'billing'|'money'){
 if(!page||page.isClosed())return
 try{const snapshot=await page.evaluate(selected=>{
  const root=document.querySelector('#__nuxt') as unknown as {__vue_app__?:{config?:{globalProperties?:{$nuxt?:Record<string,unknown>}}}}
  const c=root?.__vue_app__?.config?.globalProperties?.$nuxt?.[selected==='billing'?'$doctorPracticeBilling':'$doctorPracticeMoney'] as {state?:{ready?:boolean;loading?:boolean;pending?:boolean;uncertain?:boolean;error?:string|null;locationId?:unknown;locations?:{rows?:unknown[]};board?:{canWrite?:boolean;entitlement?:{state?:string}};data?:{canWrite?:boolean;entitlement?:{state?:string}};priceOpen?:boolean;chargeOpen?:boolean}}|undefined,s=c?.state,b=s?.board??s?.data
  return{controller_present:Boolean(c),ready:s?.ready===true,loading:s?.loading===true,pending:s?.pending===true,uncertain:s?.uncertain===true,selected_location:Boolean(s?.locationId),has_locations:Boolean(s?.locations?.rows?.length),has_board:Boolean(b),can_write:b?.canWrite===true,price_open:s?.priceOpen===true,charge_open:s?.chargeOpen===true,error:['denied','network','invalid','session','stale','inactive'].includes(String(s?.error))?String(s?.error):s?.error?'other':'none',entitlement:['preview','trial','paid','expired','suspended','unconfigured','grace'].includes(String(b?.entitlement?.state))?String(b?.entitlement?.state):'other'}
 },kind);info.annotations.push({type:'financial-notice-diagnostic',description:JSON.stringify(snapshot)})}catch{info.annotations.push({type:'financial-notice-diagnostic',description:JSON.stringify({capture_unavailable:true})})}
}
