import { useShopScopeStore } from '~/stores/scope'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { CommodityQuote } from '~/types/commodityPricing'
import { commodityFailure } from '~/utils/commodityPricingCopy'
/** Bounded source choices, loaded only when the product-rule editor needs them. */
export function useCommodityQuotePicker(){
 const {currentId}=useShop(),scope=useShopScopeStore(),user=useSupabaseUser(),{locale}=useI18n(),rpc=useShopClient<ShopRpcDatabase>().schema('public'),captureScope=useShopTaskScope()
 const items=shallowRef<CommodityQuote[]>([]),pending=ref(false),error=ref<string|null>(null),total=ref(0);let generation=0,page=1,term='',lastAppend=false
 async function load(append=false){
  const valid=captureScope(),token=++generation,next=append?page+1:1;lastAppend=append;if(!currentId.value)return;pending.value=true;error.value=null
  try{const r=await rpc.rpc('commodity_pricing_context',{p_shop_id:currentId.value,p_kind:'quote_options',p_search:term||null,p_page:next});if(!valid()||token!==generation)return;if(r.error)throw r.error
   if(!r.data||!Array.isArray(r.data.items)||r.data.items.length>20||r.data.items.some(q=>!('price_per_kg' in q)||typeof q.price_per_kg!=='string')||!Number.isSafeInteger(r.data.total))throw new Error('INVALID_COMMODITY_CHOICES')
   const rows=r.data.items as CommodityQuote[];items.value=append?[...items.value,...rows.filter(q=>!items.value.some(i=>i.id===q.id))]:rows;total.value=r.data.total;page=next
  }catch(cause){if(valid()&&token===generation)error.value=commodityFailure(cause,locale.value==='ar')}
  finally{if(valid()&&token===generation)pending.value=false}
 }
 function reset(){generation++;items.value=[];total.value=0;page=1;term='';error.value=null;pending.value=false}
 watch([()=>scope.actorId,()=>scope.revision,currentId,()=>user.value?.id],reset,{flush:'sync'});onScopeDispose(()=>{generation++})
 return{items,pending,error,hasMore:computed(()=>items.value.length<total.value),reset,load,query:(value:string)=>{term=value.trim().slice(0,120);void load()},more:()=>{if(!pending.value&&items.value.length<total.value)void load(true)},retry:()=>load(lastAppend)}
}
