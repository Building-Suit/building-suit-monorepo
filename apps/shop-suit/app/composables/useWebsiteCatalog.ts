import { readPublicLogo } from '@building-suit/ux'
import type { BsWebsiteCatalogView } from '@building-suit/ui/types/websiteCatalogPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { emptyWebsiteCatalogEntry, parseWebsiteCatalogSettings, type WebsiteCatalogItem } from '#shared/websiteCatalog'

export function useWebsiteCatalog(canManage:Ref<boolean>,refreshProfile:()=>Promise<unknown>) {
  const { refreshShopQueries } = useShopInvalidation()

  const {currentId,currentLocationId,isOwner,businessCurrency}=useShop()
  const {locale}=useI18n()
  const user=useSupabaseUser()
  const actor=computed(()=>user.value?.id??null)
  const canEdit=computed(()=>canManage.value&&isOwner.value)
  const environment=useRuntimeConfig().public.supabase.url
  const captureScope=useShopTaskScope()
  const client=useShopClient<ShopRpcDatabase>().schema('public')
  const form=ref(emptyWebsiteCatalogEntry()),selected=ref<WebsiteCatalogItem|null>(null)
  const search=ref(''),page=ref(1),success=ref(''),imagePending=ref(false)
  const action=useRecordAction(()=>form.value)
  const {visible:open,pending,dirty,error}=action
  const {data,pending:loading,error:loadError,refresh}=useShopQuery(
    ()=>`shop-data:website-catalog:${JSON.stringify([environment,'shop-crm',actor.value,currentId.value,search.value,page.value])}`,
    async()=>{
      if(!currentId.value||!actor.value||!canEdit.value)return null
      const isCurrent=captureScope()
      const response=await client.rpc('shop_website_catalog',{p_shop_id:currentId.value,p_search:search.value,p_page:page.value})
      if(response.error)throw response.error
      return isCurrent()?parseWebsiteCatalogSettings(response.data):null
    },{server:false,enabled:canEdit,watch:[currentId,currentLocationId,actor,canEdit],default:()=>null},
  )
  watch(search,()=>{page.value=1})
  watch([currentId,currentLocationId,actor,canEdit],()=>{open.value=false;form.value=emptyWebsiteCatalogEntry();selected.value=null;search.value='';page.value=1;success.value='';error.value=''}, {flush:'sync'})
  const find=(id:string)=>data.value?.items.find(item=>`${item.kind}:${item.itemId}`===id)
  function edit(id:string) {
    const item=find(id)
    if(!item||!canEdit.value||pending.value)return
    selected.value=item
    form.value={publicName:item.configured?item.publicName:item.operationalName,description:item.description,image:item.image,displayOrder:item.displayOrder,showPrice:item.showPrice}
    success.value='';action.edit()
  }
  const safeError=()=>locale.value==='ar'?'تعذر حفظ الكتالوج العام. راجع البيانات والصلاحيات وحاول مرة أخرى.':'Could not update the public catalog. Check details and permissions, then retry.'
  async function invalidate(isCurrent:()=>boolean) {
    if(!isCurrent()||!canEdit.value)return
    // Invalidate every cached search/page for this exact actor + Shop, then
    // refresh PROFILE's published-item readiness in the same scoped lifecycle.
    const prefix=`shop-data:website-catalog:${JSON.stringify([environment,'shop-crm',actor.value,currentId.value]).slice(0,-1)},`
    await Promise.all([refreshShopQueries(key=>key.startsWith(prefix)),refreshProfile()])
  }
  async function save() {
    const item=selected.value,shop=currentId.value,isCurrent=captureScope()
    if(!shop||!item||!canEdit.value||imagePending.value)return
    const saved=await action.run(async()=>{
      const response=await client.rpc('shop_website_catalog_save',{p_shop_id:shop,p_kind:item.kind,p_item_id:item.itemId,p_entry:form.value})
      if(response.error)throw response.error
      await invalidate(isCurrent)
    },safeError)
    if(saved&&isCurrent())success.value=locale.value==='ar'?'تم حفظ الإعدادات العامة. لم تتغير حالة النشر.':'Public details saved. Publication state is unchanged.'
  }
  async function publish(id:string,published:boolean) {
    const item=find(id),shop=currentId.value,isCurrent=captureScope()
    if(!item||!shop||!canEdit.value||pending.value||imagePending.value||published&&(!item.configured||!item.active))return
    const saved=await action.run(async()=>{
      const response=await client.rpc('shop_website_catalog_publish',{p_shop_id:shop,p_kind:item.kind,p_item_id:item.itemId,p_published:published})
      if(response.error)throw response.error
      await invalidate(isCurrent)
    },safeError)
    if(saved&&isCurrent())success.value=published?(locale.value==='ar'?'تم نشر العنصر في الكتالوج العام. نشر الموقع مستقل.':'Item published to the public catalog. Website publication is separate.'):(locale.value==='ar'?'تم إلغاء نشر العنصر مع الاحتفاظ بإعداداته وحالته التشغيلية.':'Item unpublished. Its configuration and operational state are retained.')
  }
  async function image(value:File|File[]|null) {
    const file=Array.isArray(value)?value[0]:value,isCurrent=captureScope()
    if(!file||!canEdit.value||pending.value||imagePending.value)return
    imagePending.value=true;error.value=''
    try {const result=await readPublicLogo(file);if(isCurrent()&&canEdit.value)form.value={...form.value,image:result}}
    catch {if(isCurrent())error.value=locale.value==='ar'?'اختر PNG أو JPEG أو WebP صحيحة حتى 128 كيلوبايت و2048 بكسل.':'Choose a valid PNG, JPEG or WebP up to 128 KiB and 2048 pixels.'}
    finally{imagePending.value=false}
  }
  const view=computed<BsWebsiteCatalogView>(()=>{
    const ar=locale.value==='ar'
    const contact=ar?'تواصل لمعرفة السعر':'Contact for price'
    return {
      title:ar?'الكتالوج العام':'Public catalog',help:ar?'كل المنتجات والخدمات خاصة حتى ينشرها المالك صراحة. إخفاء السعر يمنع إرساله في البيانات العامة. الأرشفة تخفي العنصر بدون تغيير إعدادات النشر.':'Products and services stay private until the owner publishes each one. Hidden prices are omitted from public data. Archiving hides an item without changing its publication configuration.',
      loading:loading.value,denied:!canEdit.value,failed:Boolean(loadError.value),pending:pending.value||imagePending.value,dirty:dirty.value,error:error.value??'',success:success.value,
      page:page.value,total:data.value?.total??0,editorTitle:selected.value?.operationalName??'',
      rows:canEdit.value?(data.value?.items??[]).map(item=>({id:`${item.kind}:${item.itemId}`,name:item.operationalName,kindLabel:item.kind==='product'?(ar?'منتج':'Product'):(ar?'خدمة':'Service'),
        publicationLabel:item.published?(item.active?(ar?'منشور':'Published'):(ar?'منشور لكنه مؤرشف ومخفي':'Published, inactive and hidden')):(ar?'خاص':'Private'),
        priceLabel:item.showPrice&&item.price!==null?new Intl.NumberFormat(ar?'ar-EG':'en-US',{style:'currency',currency:businessCurrency.value}).format(item.price):contact,
        canPublish:item.configured&&item.active&&!item.published,canUnpublish:item.published})):[],
      copy:ar?{loading:'جارٍ التحميل',denied:'الكتالوج العام متاح للمالك فقط.',failed:'تعذر تحميل الكتالوج العام.',retry:'حاول تاني',search:'ابحث في المنتجات والخدمات',name:'العنصر التشغيلي',kind:'النوع',state:'النشر العام',price:'السعر العام',edit:'تعديل البيانات العامة',publish:'نشر العنصر',unpublish:'إلغاء نشر العنصر',save:'حفظ البيانات العامة',cancel:'إلغاء',publicName:'الاسم العام',description:'الوصف العام',image:'الصورة العامة (اختياري)',imageHelp:'PNG أو JPEG أو WebP حتى 128 كيلوبايت و2048 بكسل. لا يتم نسخ صور التشغيل.',removeImage:'إزالة الصورة',displayOrder:'ترتيب العرض',showPrice:'إظهار سعر العنصر في الكتالوج العام',previous:'السابق',next:'التالي'}:
        {loading:'Loading',denied:'Only the owner can manage the public catalog.',failed:'Could not load public catalog.',retry:'Retry',search:'Search products and services',name:'Internal item',kind:'Kind',state:'Public status',price:'Public price',edit:'Edit public details',publish:'Publish item',unpublish:'Unpublish item',save:'Save public details',cancel:'Cancel',publicName:'Public name',description:'Public description',image:'Public image (optional)',imageHelp:'PNG, JPEG or WebP up to 128 KiB and 2048 pixels. Operational images are never copied.',removeImage:'Remove image',displayOrder:'Display order',showPrice:'Show the item price in the public catalog',previous:'Previous',next:'Next'},
    }
  })
  return{form,open,search,view,edit,save,publish,image,refresh,setPage:(value:number)=>{page.value=value}}
}
