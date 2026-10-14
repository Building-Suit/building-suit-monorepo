import { parseChangePreview, parseScheduledChange } from '~/utils/scheduled-billing.mjs'
import type { ScheduledChange } from '~/utils/scheduled-billing.mjs'
type Context = { generation:number;shop:string|null;user:string|undefined }
type Target = {selection:string;catalogTermsId:string|null;privateOffer:Record<string,string|number>|null}
export function useShopScheduledBilling(input:{context:()=>Context;sameContext:(value:Context)=>boolean;target:()=>Target;invoke:(name:'preview'|'schedule'|'read'|'cancel',args:Record<string,unknown>)=>Promise<{data:unknown;error:unknown}>}) {
  const current=shallowRef<ScheduledChange|null>(null), preview=shallowRef<ReturnType<typeof parseChangePreview>|null>(null)
  const checking=ref(false), pending=ref(false), error=ref('')
  let generation=0, recordGeneration=0
  function reset(){++generation;++recordGeneration;current.value=null;preview.value=null;checking.value=false;pending.value=false;error.value=''}
  async function read(){const context=input.context(),version=++recordGeneration;if(!context.shop||!context.user)return
    try{const result=await input.invoke('read',{p_shop_id:context.shop})
      if(version!==recordGeneration||!input.sameContext(context))return
      if(result.error)throw result.error
      current.value=parseScheduledChange(result.data)
    }catch{if(version===recordGeneration&&input.sameContext(context))error.value='unavailable'}
  }
  async function review(){const context=input.context(),target=input.target(),version=++generation;preview.value=null;error.value=''
    if(!context.shop||!context.user)return
    checking.value=true
    try{const result=await input.invoke('preview',{p_shop_id:context.shop,p_catalog_terms_id:target.catalogTermsId,p_private_offer:target.privateOffer})
      if(version!==generation||!input.sameContext(context)||input.target().selection!==target.selection)return
      if(result.error)throw result.error
      preview.value=parseChangePreview(result.data);if(preview.value.scheduled)current.value=preview.value.scheduled
    }catch{if(version===generation&&input.sameContext(context))error.value='unavailable'}finally{if(version===generation)checking.value=false}
  }
  async function schedule(){const context=input.context(),target=input.target();if(!context.shop||!context.user||pending.value||preview.value?.timing!=='term_end')return
    pending.value=true;error.value='';++recordGeneration
    const key=`shop-schedule:${context.user}:${context.shop}:${target.selection}`
    try{let request=sessionStorage.getItem(key);if(!request){request=crypto.randomUUID();sessionStorage.setItem(key,request)}
      const result=await input.invoke('schedule',{p_request_id:request,p_shop_id:context.shop,p_catalog_terms_id:target.catalogTermsId,p_private_offer:target.privateOffer})
      if(!input.sameContext(context))return
      if(result.error)throw result.error
      ++recordGeneration;current.value=parseScheduledChange(result.data);sessionStorage.removeItem(key);if(input.target().selection===target.selection)return current.value
    }catch{if(input.sameContext(context))error.value='unavailable'}finally{if(input.sameContext(context))pending.value=false}
  }
  async function cancel(){const context=input.context(),id=current.value?.id;if(!context.shop||!id||!current.value?.canCancel||pending.value)return
    pending.value=true;error.value='';++recordGeneration
    try{const result=await input.invoke('cancel',{p_shop_id:context.shop,p_change_id:id});if(!input.sameContext(context))return
      if(result.error)throw result.error
      ++recordGeneration;current.value=parseScheduledChange(result.data);await review()
    }catch{if(input.sameContext(context))error.value='unavailable'}finally{if(input.sameContext(context))pending.value=false}
  }
  return {current,preview,checking,pending,error,reset,read,review,schedule,cancel}
}
