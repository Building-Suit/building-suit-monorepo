import{manualReportFilters,manualReportView}from'../utils/manualReconciliationPresentation'
import{manualReportWindow,manualReportStatuses,type ManualReportStatus}from'../utils/manualReconciliation'
export async function useDoctorManualReport(review:boolean){
 const controller=useNuxtApp().$doctorManualReport,{locale}=useI18n(),filters=ref(manualReportFilters()),invalid=ref(false)
 const view=computed(()=>manualReportView(controller.state,review,locale.value==='ar',invalid.value))
 async function apply(){invalid.value=false;try{const window=manualReportWindow(filters.value.from,filters.value.to);if(!manualReportStatuses.includes(filters.value.status as ManualReportStatus))throw Error('invalid');await controller.load({review,...window,status:filters.value.status as ManualReportStatus,page:1})}catch{controller.clear();invalid.value=true}}
 async function refresh(){const query=controller.state.result?.query;if(query)await controller.load(query);else await apply()}
 async function page(direction:number){const query=controller.state.result?.query;if(query)await controller.load({...query,page:query.page+direction})}
 onBeforeUnmount(()=>controller.clear());await apply();return{filters,view,apply,refresh,page}
}
