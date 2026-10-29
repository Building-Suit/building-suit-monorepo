import {createNativeOnlinePolicy,type NativeOnlinePolicyState} from '../utils/nativeOnlinePolicy'
import {createNativeAppointments,nativeAppointmentsState,type NativeScheduleScope} from '../utils/nativeAppointments'
import {createNativeAppointmentsRepository} from '../utils/nativeAppointmentsRepository'
import {createNativePrescriptionReview,nativePrescriptionReviewState} from '../utils/nativePrescriptionReview'
import {createNativeEncounter,nativeEncounterState} from '../utils/nativeEncounter'
import {createNativeEncounterRepository} from '../utils/nativeEncounterRepository'
import {createNativePatients,nativePatientsState} from '../utils/nativePatients'
import {createNativePatientsRepository} from '../utils/nativePatientsRepository'
import {createNativeContext,nativeContextState,nativeContextId} from '../utils/nativeContext'
import {createNativeContextRepository} from '../utils/nativeContextRepository'
import {App} from '@capacitor/app'
import {Capacitor} from '@capacitor/core'
import{createNativeSession,nativeSessionState}from'../utils/nativeSession'
import{createNativeSessionBackend,nativeSessionConfiguration}from'../utils/nativeSessionBackend'
import{nativeSessionVault}from'../utils/nativeSessionVault'
import{nativeAuthTransport}from'../utils/nativeTransport'
import {createDoctorMobileShell,doctorMobileDestination,doctorMobileBackDestination,type MobileShellState} from '../utils/mobileShell'
import {createDoctorMobileLinks} from '../utils/nativeLinks'
export default defineNuxtPlugin(async app=>{
  const state=reactive<MobileShellState>({phase:'signed-out',route:'/workspace',context:null})
  const configured=nativeSessionConfiguration(useRuntimeConfig().public.doctorNativeAuth)
  const backend=configured&&Capacitor.getPlatform()==='android'?createNativeSessionBackend(configured,nativeAuthTransport):null
  const readiness=ref<'checking'|'enabled'|'disabled'>(backend?'checking':'disabled')
  const auth=createNativeSession(backend,nativeSessionVault(),reactive(nativeSessionState()),()=>{shell?.sessionChanged();void context?.clear()})
  const repository=configured&&backend?createNativeContextRepository(configured,nativeAuthTransport,auth.accessToken):null
  const context=createNativeContext(repository,auth.identity,reactive(nativeContextState()),()=>shell?.sessionChanged())
  app.provide('doctorNativeContext',context)
  const patientRepository=configured&&repository?createNativePatientsRepository(configured,nativeAuthTransport,auth,()=>context.state.phase==='ready'?context.state.current:null,repository,()=>{void context.clear()}):null
  const patients=createNativePatients(patientRepository,()=>auth.identity()&&onlinePolicy?.admitted()&&context.state.phase==='ready'?context.state.current?.context??null:null,reactive(nativePatientsState()))
  context.registerClear(patients.clear)
  app.provide('doctorNativePatients',patients)
  const encounterRepository=configured&&repository?createNativeEncounterRepository(configured,nativeAuthTransport,auth,()=>context.state.phase==='ready'?context.state.current:null,repository,()=>{void context.clear()}):null
  const encounters=createNativeEncounter(encounterRepository,()=>auth.identity()&&onlinePolicy?.admitted()&&context.state.phase==='ready'?context.state.current?.context??null:null,reactive(nativeEncounterState()))
  context.registerClear(encounters.clear)
  app.provide('doctorNativeEncounter',encounters)
  const prescriptionReview=createNativePrescriptionReview(encounterRepository,()=>auth.identity()&&onlinePolicy?.admitted()&&context.state.phase==='ready'?context.state.current?.context??null:null,()=>encounters.state.detail,encounters.observe,()=>{void context.clear()},encounters.dirty,{state:reactive(nativePrescriptionReviewState()),historyPage:()=>encounters.state.historyPage})
  context.registerClear(prescriptionReview.clear)
  app.provide('doctorNativePrescriptionReview',prescriptionReview)
  const appointmentScope=():NativeScheduleScope|null=>auth.identity()&&context.state.phase==='ready'&&context.state.current?.timezone&&context.state.current.context.capabilities.includes('appointments.read')?{...context.state.current.context,timezone:context.state.current.timezone}:null
  const appointmentRepository=configured&&repository?createNativeAppointmentsRepository([configured,nativeAuthTransport,auth,()=>context.state.phase==='ready'?context.state.current:null,repository,()=>{void context.clear()}],()=>context.state.options,appointmentScope):null
  const appointments=createNativeAppointments(appointmentRepository,reactive(nativeAppointmentsState()),appointmentScope)
  context.registerClear(appointments.clear)
  app.provide('doctorNativeAppointments',appointments)
  app.provide('doctorNativeAppointmentScope',appointmentScope)
  const shell:ReturnType<typeof createDoctorMobileShell>=createDoctorMobileShell({identity:auth.identity,selection:context.selection,load:async(_route,selection,signal)=>{const choice=context.state.current,identity=auth.identity();if(!repository||!choice||!identity||nativeContextId(choice.context)!==nativeContextId(selection))throw new Error('Unavailable');return(await repository.resolve(choice,identity,signal)).context}},state)
  app.provide('doctorNativeSession',auth);app.provide('doctorNativeAvailability',readiness)
  let admission=0,disposed=false,active=true,monitor:ReturnType<typeof setTimeout>|undefined,expiry:ReturnType<typeof setTimeout>|undefined
  function stopMonitor(){if(monitor!==undefined)clearTimeout(monitor);if(expiry!==undefined)clearTimeout(expiry);monitor=undefined;expiry=undefined}
  function schedule(){
   stopMonitor()
   if(disposed||!active||!navigator.onLine||!backend||auth.state.phase!=='ready')return
   const delay=Math.max(1000,Math.min(30000,(auth.expiresAt()??Date.now())-Date.now()-15000))
   // A slow request cannot extend the current view past known token expiry.
   expiry=setTimeout(()=>{auth.lock();void admit()},Math.max(0,(auth.expiresAt()??Date.now())-Date.now()-1000))
   monitor=setTimeout(()=>{monitor=undefined;void auth.revalidate().then(async ready=>{if(ready){await context.refresh();if(context.state.phase==='ready'&&encounters.state.outcome!=='submitting')await prescriptionReview.revalidate();if(auth.state.phase==='ready')onlinePolicy.grant(onlinePolicy.capture())}else await context.clear()}).finally(schedule)},delay)
  }
  watch(()=>[auth.state.phase,auth.state.revision],schedule)
  async function admit(){
   const revision=++admission
   if(!backend){readiness.value='disabled';return}
   auth.lock()
   readiness.value='checking'
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000)
   try{
    const allowed=await backend.marker(controller.signal)
    if(disposed||revision!==admission)return
    if(allowed){
     await auth.resume();if(auth.identity())await context.refresh()
     if(!disposed&&revision===admission){readiness.value=auth.state.error==='storage'?'disabled':'enabled';if(auth.state.phase==='ready')onlinePolicy.grant(onlinePolicy.capture());await shell.retry()}
    }else{readiness.value='disabled';auth.lock()}
   }catch{if(!disposed&&revision===admission){readiness.value='disabled';auth.lock()}}
   finally{clearTimeout(timer)}
  }
  const onlinePolicy=createNativeOnlinePolicy(()=>{admission++;stopMonitor();readiness.value=backend?'enabled':'disabled';auth.lock();shell.sessionChanged()},{state:reactive<NativeOnlinePolicyState>({active:true,online:true,admitted:false,revision:0,reason:'starting'})})
  watch(()=>auth.state.phase,phase=>{if(phase==='ready')void context.refresh();else onlinePolicy.forget()})
  watch(()=>context.state.current,()=>{void shell.retry()})
  void admit()
  app.provide('doctorMobile',shell)
  const offline=()=>{onlinePolicy.setOnline(false);shell.connectivity(false)},online=()=>{onlinePolicy.setOnline(true);shell.connectivity(true);if(onlinePolicy.state.active)void admit()}
  window.addEventListener('offline',offline);window.addEventListener('online',online)
  if (!navigator.onLine) offline()
  const subscriptions: {remove:()=>Promise<void>}[]=[]
  const links=createDoctorMobileLinks(async url=>{
    const destination=doctorMobileDestination(url)
    await shell.navigate(url)
    if(!disposed)await app.$router.replace(destination??'/unavailable')
  },()=>{shell.sessionChanged()})
  app.hook('app:mounted',()=>links.mount())
  if (Capacitor.isNativePlatform()) {
    subscriptions.push(await App.addListener('appUrlOpen',event=>{void links.event(event.url)}))
    subscriptions.push(await App.addListener('backButton',()=>{const destination=doctorMobileBackDestination(app.$router.currentRoute.value.path);if(destination)void app.$router.push(destination);else {auth.lock();shell.sessionChanged();void App.exitApp()}}))
    subscriptions.push(await App.addListener('appStateChange',event=>{active=event.isActive;onlinePolicy.setActive(active);if(active&&onlinePolicy.state.online){void admit();if(!backend)void shell.retry()}}))
    const launch=await App.getLaunchUrl();if(launch)await links.launch(launch.url)
  }
  app.vueApp.onUnmount(()=>{disposed=true;links.dispose();admission++;stopMonitor();onlinePolicy.dispose();auth.dispose();shell.dispose();window.removeEventListener('offline',offline);window.removeEventListener('online',online);for(const subscription of subscriptions)void subscription.remove()})
})
