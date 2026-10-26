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
