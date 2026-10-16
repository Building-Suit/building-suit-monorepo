import type {BsWebsiteInquiryInboxView} from '@building-suit/ui/types/websiteInquiriesPresentation'
import type {ShopRpcDatabase} from '~/types/shopCrmRpc'
import {parseWebsiteInquiryInbox,type PrivateWebsiteInquiry,type WebsiteInquiryStatus} from '#shared/websiteInquiries'
export function useWebsiteInquiries(canManage:Ref<boolean>) {
 const {currentId,currentLocationId,isOwner}=useShop(),{locale}=useI18n(),user=useSupabaseUser()
 const actor=computed(()=>user.value?.id??null),canRead=computed(()=>canManage.value&&isOwner.value)
 const environment=useRuntimeConfig().public.supabase.url,client=useSupabaseClient<ShopRpcDatabase>().schema('public'),captureScope=useShopTaskScope()
 const filter=ref('all'),page=ref(1),status=ref('new'),selected=ref<PrivateWebsiteInquiry|null>(null)
 const action=useRecordAction(()=>status.value),{visible:open,pending,dirty,error}=action
 const {data,pending:loading,error:loadError,refresh}=useAsyncData(
  ()=>`shop-data:website-inquiries:${JSON.stringify([environment,'shop-crm',actor.value,currentId.value,filter.value,page.value])}`,
  async()=>{if(!currentId.value||!canRead.value||!actor.value)return null;const isCurrent=captureScope();const response=await client.rpc('shop_website_inquiries',{p_shop_id:currentId.value,p_status:filter.value,p_page:page.value});if(response.error)throw response.error;return isCurrent()&&canRead.value?parseWebsiteInquiryInbox(response.data):null},
  {server:false,watch:[currentId,currentLocationId,actor,canRead],default:()=>null},
 )
 watch(filter,()=>{page.value=1})
 watch([currentId,currentLocationId,actor,canRead],()=>{open.value=false;selected.value=null;status.value='new';filter.value='all';page.value=1;error.value=''}, {flush:'sync'})
 function edit(id:string){const item=data.value?.items.find(i=>i.id===id);if(!canRead.value||!item)return;selected.value=item;status.value=item.status;action.edit()}
 async function save(){const shop=currentId.value,item=selected.value,isCurrent=captureScope();if(!shop||!item||!canRead.value||!['new','read','closed'].includes(status.value))return
  await action.run(async()=>{const response=await client.rpc('shop_website_inquiry_status',{p_shop_id:shop,p_inquiry_id:item.id,p_status:status.value as WebsiteInquiryStatus});if(response.error)throw response.error;if(isCurrent()&&canRead.value){const prefix=`shop-data:website-inquiries:${JSON.stringify([environment,'shop-crm',actor.value,currentId.value]).slice(0,-1)},`;clearNuxtData(k=>k.startsWith(prefix));await refresh()}},()=>locale.value==='ar'?'تعذر تحديث الاستفسار. حاول مرة أخرى.':'Could not update inquiry. Please retry.')
 }
 const view=computed<BsWebsiteInquiryInboxView>(()=>{const ar=locale.value==='ar',labels={new:ar?'جديد':'New',read:ar?'تمت قراءته':'Read',closed:ar?'مغلق':'Closed'}
  const row=(i:PrivateWebsiteInquiry)=>({id:i.id,name:i.name,contact:i.contact,message:i.message,statusLabel:labels[i.status],createdLabel:new Intl.DateTimeFormat(ar?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(i.createdAt))})
  return{title:ar?'استفسارات الموقع':'Website inquiries',help:ar?'استفسارات خاصة من الموقع العام. يمكن للمالك فقط قراءتها وتحديث حالتها.':'Private inquiries from the public website. Only the owner can read them and update their status.',loading:loading.value,denied:!canRead.value,failed:Boolean(loadError.value),pending:pending.value,dirty:dirty.value,error:error.value??'',rows:canRead.value?(data.value?.items??[]).map(row):[],selected:canRead.value&&selected.value?row(selected.value):null,page:page.value,total:canRead.value?data.value?.total??0:0,statusOptions:Object.entries(labels).map(([value,label])=>({value,label})),
   copy:ar?{loading:'جارٍ التحميل',denied:'استفسارات الموقع متاحة للمالك فقط.',failed:'تعذر تحميل الاستفسارات.',retry:'حاول تاني',name:'الاسم',contact:'وسيلة الاتصال',message:'الرسالة',created:'التاريخ',status:'الحالة',open:'عرض الاستفسار',save:'حفظ الحالة',cancel:'إلغاء',all:'الكل',previous:'السابق',next:'التالي'}:{loading:'Loading',denied:'Website inquiries are available to the owner only.',failed:'Could not load inquiries.',retry:'Retry',name:'Name',contact:'Contact',message:'Message',created:'Received',status:'Status',open:'Open inquiry',save:'Save status',cancel:'Cancel',all:'All',previous:'Previous',next:'Next'}}
 })
 return{view,filter,status,open,edit,save,refresh,setPage:(value:number)=>{page.value=value}}
}
