import type { BsPracticeReportFilters } from '@building-suit/ui/utils/practiceLedgerReportPresentation'
import { financialReportLocation,financialReportHref } from '../utils/practiceFinancialReportNavigation'
import { practiceReportCopy,practiceReportView } from '../utils/practiceFinancialReportPresentation'
export async function useDoctorFinancialReports(){
 const controller=useNuxtApp().$doctorFinancialReport,auth=useDoctorAuth(),route=useRoute(),router=useRouter(),{locale}=useI18n()
 const location=computed(()=>{try{return financialReportLocation(route.query)}catch{return null}}),copy=computed(()=>practiceReportCopy(locale.value==='ar')),view=computed(()=>practiceReportView(controller,location.value,locale.value==='ar'))
 const filters=ref<BsPracticeReportFilters>({location:'',from:'',until:'',status:'all',metric:'charges',group:''})
 function project(){const l=location.value;if(l)filters.value={location:l.locationId??'',from:l.query.from?.slice(0,10)??'',until:l.query.until?.slice(0,10)??'',status:l.query.status,metric:l.query.metric,group:l.query.currency?`${l.query.currency}:${l.query.exponent}`:''}}
 let disposed=false,sequence=0
 async function load(){if(disposed||auth.state.pending||auth.state.phase!=='authenticated')return;const a=auth.state.identity,l=location.value,run=++sequence;project();if(!l){controller.clear();controller.state.error='invalid';return}
  controller.closeSource();const ok=await controller.read(a?.practiceId?{userId:a.userId,practiceId:a.practiceId,locationId:l.locationId}:null,l.query)
  if(ok&&l.source&&!disposed&&run===sequence)await controller.source(l.source)
 }
 async function apply(){try{const l=financialReportLocation({...filters.value,page:'1'});const href=financialReportHref(l);if(route.fullPath===href)await load();else await router.push(href)}catch{controller.clear();controller.state.error='invalid'}}
 async function page(direction:number){const l=location.value;if(!l||![-1,1].includes(direction))return;await router.push(financialReportHref({...l,source:null,query:{...l.query,page:l.query.page+direction}}))}
 async function closeSource(){controller.closeSource();const l=location.value;if(l)await router.replace(financialReportHref({...l,source:null}))}
 const stopAuth=watch(()=>[auth.state.phase,auth.state.identity?.userId,auth.state.identity?.sessionId,auth.state.identity?.practiceId],()=>{sequence++;controller.clear();void controller.locations();void load()})
 const stopRoute=watch(()=>[route.fullPath,auth.state.pending],()=>{void load()})
 onMounted(()=>{void controller.locations();void load()})
 onBeforeUnmount(()=>{disposed=true;sequence++;stopAuth();stopRoute();controller.clear()})
 await load()
 return{copy,view,filters,apply,refresh:load,page,closeSource,clinicPage:(direction:number)=>controller.locations(controller.state.locationPage+direction)}
}
