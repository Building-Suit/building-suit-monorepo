import{downloadBlob}from'@building-suit/ux'
import type{BsManualPaymentValues}from'@building-suit/ui/types/manualPaymentPresentation'
import{manualPaymentValues,manualPaymentView}from'../utils/manualPaymentPresentation'
import{watchManualPaymentSession}from'../utils/manualPaymentSession'
export async function useDoctorManualPayment(review:boolean){
 const controller=useNuxtApp().$doctorManualPayment,{locale}=useI18n()
 const auth=useDoctorAuth(),page=controller.claimPage()
 const route=useRoute()
 const view=computed(()=>manualPaymentView(controller,locale.value==='ar'))
 const values=computed(()=>manualPaymentValues(controller))
 function update(value:BsManualPaymentValues){if(controller.state.pending||controller.state.uncertain)return;Object.assign(controller.state,{...value,interval:value.interval==='yearly'?'yearly':'monthly'})}
 async function refresh(number=controller.state.page){if(page.active()&&await controller.load(review,number)&&page.active()){await controller.choose();const notice=route.query.notice;if(typeof notice==='string'&&page.active())await controller.open(notice)}}
 async function download(id:string){const file=controller.selected()?.evidence.find(e=>e.id===id);if(!file)return;const blob=await controller.download(id);if(blob)downloadBlob(file.filename,blob)}
 const stop=watchManualPaymentSession(auth.state,controller.state,page.active,()=>refresh())
 onBeforeUnmount(()=>{stop();page.release()})
 await refresh(1)
 return{controller,view,values,update,refresh,download}
}
