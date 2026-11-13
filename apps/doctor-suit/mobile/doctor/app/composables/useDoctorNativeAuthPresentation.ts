export function useDoctorNativeAuthPresentation(){
 const{auth,readiness}=useDoctorNativeAuth(),{t}=useI18n()
 const product=computed(()=>({name:t('product.name'),assetPrefix:'doctor-suit',homeLabel:t('auth.home'),title:t('auth.welcome'),description:t('notice')}))
 const availability=computed(()=>readiness.value==='enabled'?undefined:{state:readiness.value==='checking'?'loading' as const:'permission' as const,title:t(readiness.value==='checking'?'auth.checking':'auth.unavailable'),description:t('auth.connectionRequired')})
 const error=computed(()=>auth.state.error?t('auth.errors.'+auth.state.error):null)
 return{auth,readiness,product,availability,error,t}
}
