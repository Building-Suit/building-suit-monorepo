import{downloadBlob}from'@building-suit/ux'
import type{BsManualPaymentValues}from'@building-suit/ui/types/manualPaymentPresentation'
import{manualPaymentValues,manualPaymentView}from'../utils/manualPaymentPresentation'
export async function useDoctorManualPayment(review:boolean){
 const controller=useNuxtApp().$doctorManualPayment,{locale}=useI18n()
 const view=computed(()=>manualPaymentView(controller,locale.value==='ar'))
 const values=computed(()=>manualPaymentValues(controller))
 function update(value:BsManualPaymentValues){if(controller.state.pending||controller.state.uncertain)return;Object.assign(controller.state,{...value,interval:value.interval==='yearly'?'yearly':'monthly'})}
 async function refresh(page=controller.state.page){if(await controller.load(review,page))await controller.choose()}
 async function download(id:string){const file=controller.selected()?.evidence.find(e=>e.id===id);if(!file)return;const blob=await controller.download(id);if(blob)downloadBlob(file.filename,blob)}
 onBeforeUnmount(()=>controller.clear())
 const notice=useRoute().query.notice
 await refresh(1)
 if(typeof notice==='string')await controller.open(notice)
 return{controller,view,values,update,refresh,download}
}
