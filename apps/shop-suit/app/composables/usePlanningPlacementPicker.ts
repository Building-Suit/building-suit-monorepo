import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
/** Scoped, bounded choices for metadata positions; these never allocate stock. */
export function usePlanningPlacementPicker(kind: 'bin' | 'reel', productId: () => string) {
 const rpc=useShopClient<ShopRpcDatabase>().schema('public'),{currentId,currentLocationId}=useShop(),user=useSupabaseUser(),{locale}=useI18n(),captureScope=useShopTaskScope()
 const items=ref<{id:string;name:string}[]>([]),revisions=ref<Record<string,number>>({}),pending=ref(false),failed=ref(false),total=ref(0),seen=ref(0),page=ref(1),search=ref('');let generation=0
 async function load(append=false){
  const token=++generation,valid=captureScope();if(!currentId.value||!currentLocationId.value||kind==='reel'&&!productId()){items.value=[];seen.value=0;total.value=0;pending.value=false;return}
  pending.value=true;failed.value=false
  try{
   const args={p_shop_id:currentId.value,p_location_id:currentLocationId.value,p_search:search.value.trim()||null,p_page:page.value}
   let rows:{id:string;name:string;revision?:number}[],rawCount:number,count:number
   if(kind==='bin'){
    const r=await rpc.rpc('inventory_planning_context',{...args,p_kind:'bin'});if(r.error)throw r.error
    if(!r.data||!Array.isArray(r.data.items)||!Number.isSafeInteger(r.data.total))throw new Error('INVALID_BIN_CHOICES')
    rawCount=r.data.items.length;count=r.data.total;rows=r.data.items.filter(row=>row.active).map(row=>({id:row.id,name:`${row.code} · ${row.name}`}))
   }else{
    const r=await rpc.rpc('inventory_reel_context',{...args,p_product_id:productId(),p_page_size:20});if(r.error)throw r.error
    if(!r.data||!Array.isArray(r.data.items)||!Number.isSafeInteger(r.data.total))throw new Error('INVALID_REEL_CHOICES')
    rawCount=r.data.items.length;count=r.data.total;rows=r.data.items.filter(row=>row.status!=='archived').map(row=>({id:row.id,name:`${row.barcode} · ${row.remainingLength} ${row.unit}`,revision:row.revision}))
   }
   if(!valid()||token!==generation)return
   total.value=count;seen.value=(append?seen.value:0)+rawCount;items.value=append?[...items.value,...rows]:rows
   revisions.value={...(append?revisions.value:{}),...Object.fromEntries(rows.filter(row=>row.revision!==undefined).map(row=>[row.id,row.revision!]))}
  }catch{if(valid()&&token===generation)failed.value=true}finally{if(valid()&&token===generation)pending.value=false}
 }
 function query(value:string){search.value=value;page.value=1;void load()}
 function more(){if(pending.value||seen.value>=total.value)return;page.value++;void load(true)}
 watch([currentId,currentLocationId,()=>user.value?.id,productId],()=>{generation++;items.value=[];revisions.value={};page.value=1;seen.value=0;total.value=0;search.value='';void load()},{immediate:true})
 onScopeDispose(()=>{generation++})
 return{items,revisions,pending,hasMore:computed(()=>seen.value<total.value),error:computed(()=>failed.value?(locale.value==='ar'?'تعذّر تحميل الخيارات.':'Could not load choices.'):null),query,more,retry:()=>load(page.value>1)}
}
