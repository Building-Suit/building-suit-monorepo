import { readWebsiteImage } from '@building-suit/ux'
import type { BsStorefrontBuilderView } from '@building-suit/ui/types/storefrontBuilderPresentation'
import { emptyStorefrontLayout, parseStorefrontLayout, type StorefrontLayout } from '#shared/storefrontBuilder'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
export function useStorefrontBuilder() {
 const { currentId }=useShop(),user=useSupabaseUser(),{locale}=useI18n(),rpc=useShopClient<ShopRpcDatabase>().schema('public'),captureScope=useShopTaskScope()
 const form=ref<StorefrontLayout>(emptyStorefrontLayout()),success=ref(''),imagePending=ref(false),action=useRecordAction(()=>form.value)
 const {visible:editor}=action
 const query=useShopQuery(()=>`shop-data:storefront-builder:${currentId.value}`,async()=>{
  if(!currentId.value)return null
  const valid=captureScope(),response=await rpc.rpc('shop_storefront_builder',{p_shop_id:currentId.value})
  if(response.error)throw response.error
  if(response.data?.draft)parseStorefrontLayout(response.data.draft)
  return valid()?response.data:null
 },{scope:'shop',server:false,enabled:()=>!!currentId.value,default:()=>null})
 const clone=(value:StorefrontLayout)=>JSON.parse(JSON.stringify(value)) as StorefrontLayout
 function restore(){form.value=clone(query.data.value?.draft??emptyStorefrontLayout())}
 watch([query.data,editor],()=>{if(!editor.value)restore()},{immediate:true})
 watch([currentId,()=>user.value?.id],()=>{action.complete();form.value=emptyStorefrontLayout();success.value='';action.error.value=''}, {flush:'sync'})
 const ar=computed(()=>locale.value==='ar')
 const copy=computed(()=>ar.value?{
  title:'منشئ موقع المتجر',help:'صمّم واجهة متجرك بالبانر والعروض والصور وفريقك. تبقى المسودة خاصة حتى تنشرها.',edit:'تعديل التصميم',save:'حفظ المسودة',cancel:'إلغاء',publish:'نشر التصميم',publishHelp:'ينشر المالك آخر مسودة محفوظة. لا يغيّر بيانات التشغيل أو الإيصالات.',published:'تصميم منشور',draft:'مسودة',noShop:'اختر متجرًا.',loading:'جارٍ التحميل…',failed:'تعذر تحميل منشئ الموقع. تحتاج صلاحية إدارة الإعدادات.',retry:'إعادة المحاولة',teamMulti:'متاح لخطتي Team وMulti',upgradeHelp:'اختر Team أو Multi لتخصيص موقعك. تبقى التصاميم المحفوظة محفوظة عند تغيير الخطة.',billing:'الاشتراك والفوترة',profile:'الملف العام',catalog:'المنتجات والخدمات',offers:'العروض والباقات',publishProfile:'انشر الملف العام والكتالوج أولًا من الإعدادات.',preview:'معاينة المسودة',previewHelp:'هذه معاينة البانر والصور والفريق. يظهر الكتالوج الحقيقي ووسائل الاتصال من إعدادات النشر العامة.',noBanner:'بدون بانر: يظهر البحث في أعلى الصفحة.',search:'البحث عن المنتجات والخدمات',banner:'البانر',uploadBanner:'رفع بانر',imageHelp:'PNG أو JPEG أو WebP حتى 5 ميجابايت؛ تُحسّن الصورة إلى 128 كيلوبايت و2048 بكسل.',bannerTitle:'عنوان البانر',bannerSubtitle:'نص البانر',alt:'وصف الصورة لقارئ الشاشة',sections:'أقسام الموقع',showOffers:'إظهار العروض المنشورة',showGallery:'إظهار معرض الصور',showStaff:'إظهار الفريق',gallery:'معرض الصور (حتى 8 صور)',caption:'وصف الصورة',addImage:'إضافة صورة',staff:'الفريق',staffHelp:'أضف فقط الأسماء والصور والأوصاف التي وافق أصحابها على نشرها. لا تُنسخ ملفات الموظفين الخاصة.',portrait:'صورة العضو',name:'الاسم العام',role:'الدور العام',bio:'نبذة',addStaff:'إضافة عضو (حتى 20)',remove:'إزالة',removeImage:'إزالة الصورة',up:'تحريك لأعلى',down:'تحريك لأسفل'
 }:{
  title:'Website builder',help:'Shape your storefront with a banner, offers, images and your team. Drafts stay private until published.',edit:'Edit design',save:'Save draft',cancel:'Cancel',publish:'Publish design',publishHelp:'The owner publishes the last saved draft. Operational data and issued receipts stay intact.',published:'Published design',draft:'Draft',noShop:'Choose a shop.',loading:'Loading…',failed:'Could not load the builder. Settings permission is required.',retry:'Retry',teamMulti:'Available on Team and Multi',upgradeHelp:'Choose Team or Multi to customize your storefront. Saved designs are retained when your plan changes.',billing:'Subscription & billing',profile:'Public profile',catalog:'Products & services',offers:'Promos & offers',publishProfile:'Publish your public profile and catalogue in Settings first.',preview:'Draft preview',previewHelp:'Preview your banner, gallery and team here. The live catalogue and contact details come from your public publishing settings.',noBanner:'No banner: search appears at the top of the page.',search:'Search products and services',banner:'Banner',uploadBanner:'Upload banner',imageHelp:'PNG, JPEG or WebP up to 5 MiB; optimized to 128 KiB and 2048 pixels.',bannerTitle:'Banner heading',bannerSubtitle:'Banner description',alt:'Image description for screen readers',sections:'Website sections',showOffers:'Show published offers',showGallery:'Show image gallery',showStaff:'Show team',gallery:'Image gallery (up to 8 images)',caption:'Image caption',addImage:'Add image',staff:'Your team',staffHelp:'Add only names, portraits and descriptions you have permission to publish. Private employee profiles are never copied.',portrait:'Team member portrait',name:'Public name',role:'Public role',bio:'Short introduction',addStaff:'Add team member (up to 20)',remove:'Remove',removeImage:'Remove image',up:'Move up',down:'Move down'
 })
 function edit(){if(!query.data.value?.eligible||action.pending.value||imagePending.value)return;restore();success.value='';action.edit()}
 function safeError(cause:unknown){const message=String((cause as {message?:string}).message??'');return message.includes('CHANGED_RELOAD')?(ar.value?'تغير التصميم في جلسة أخرى. أغلق المحرر وأعد التحميل.':'The design changed in another session. Close the editor and reload.'):message.includes('TEAM_MULTI')?copy.value.teamMulti:ar.value?'تعذر الحفظ. راجع الصور والحقول والصلاحيات ثم أعد المحاولة.':'Could not save. Review images, fields and permissions, then retry.'}
 async function save(publish=false){
  const shop=currentId.value,data=query.data.value,valid=captureScope()
  if(!shop||!data?.eligible||imagePending.value||publish&&(!data.owner||editor.value||!data.websitePublished))return
  const layout=clone(publish?(data.draft??emptyStorefrontLayout()):form.value)
  const saved=await action.run(async()=>{const response=await rpc.rpc('shop_storefront_builder_save',{p_shop_id:shop,p_layout:layout,p_revision:data.revision,p_publish:publish});if(response.error)throw response.error;if(valid())query.data.value=response.data},safeError)
  if(saved&&valid()){restore();success.value=publish?(ar.value?'تم نشر التصميم.':'Design published.'):(ar.value?'تم حفظ المسودة دون نشرها.':'Draft saved without publishing.')}
 }
 async function image(target:'banner'|'gallery'|'staff',index:number,value:File|File[]|null){
  const file=Array.isArray(value)?value[0]:value,valid=captureScope();if(!file||imagePending.value||action.pending.value||!editor.value)return
  imagePending.value=true;action.error.value=''
  try{const image=await readWebsiteImage(file);if(!valid()||!editor.value)return
   if(target==='banner')form.value={...form.value,banner:{alt:'',title:'',subtitle:'',...form.value.banner,image}}
   else if(target==='gallery'&&form.value.gallery.length<8)form.value={...form.value,gallery:[...form.value.gallery,{image,caption:''}]}
   else if(target==='staff'&&form.value.staff[index])form.value={...form.value,staff:form.value.staff.map((member,i)=>i===index?{...member,image}:member)}
  }catch{if(valid())action.error.value=copy.value.imageHelp}finally{imagePending.value=false}
 }
 const view=computed<BsStorefrontBuilderView>(()=>({available:!!currentId.value,loading:query.pending.value,failed:!!query.error.value,eligible:query.data.value?.eligible===true,owner:query.data.value?.owner===true,websitePublished:query.data.value?.websitePublished===true,pending:action.pending.value||imagePending.value,dirty:action.dirty.value,error:action.error.value??'',success:success.value,published:!!query.data.value?.published}))
 return{form,editor,view,copy,edit,save:()=>save(),publish:()=>save(true),image,retry:query.refresh}
}
