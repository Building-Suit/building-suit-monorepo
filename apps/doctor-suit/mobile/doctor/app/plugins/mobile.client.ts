import {App} from '@capacitor/app'
import {Capacitor} from '@capacitor/core'
import{createNativeSession,nativeSessionState}from'../utils/nativeSession'
import{createNativeSessionBackend,nativeSessionConfiguration}from'../utils/nativeSessionBackend'
import{nativeSessionVault}from'../utils/nativeSessionVault'
import{nativeAuthTransport}from'../utils/nativeTransport'
import {createDoctorMobileShell,doctorMobileDestination,type MobileShellState} from '../utils/mobileShell'
export default defineNuxtPlugin(async app=>{
  const state=reactive<MobileShellState>({phase:'signed-out',route:'/workspace',context:null})
  const configured=nativeSessionConfiguration(useRuntimeConfig().public.doctorNativeAuth)
  const backend=configured&&Capacitor.getPlatform()==='android'?createNativeSessionBackend(configured,nativeAuthTransport):null
  const readiness=ref<'checking'|'enabled'|'disabled'>(backend?'checking':'disabled')
  const auth=createNativeSession(backend,nativeSessionVault(),reactive(nativeSessionState()),()=>shell?.sessionChanged())
  const shell:ReturnType<typeof createDoctorMobileShell>=createDoctorMobileShell({identity:auth.identity,selection:()=>null,load:async()=>{throw new Error('Unavailable')}},state)
  app.provide('doctorNativeSession',auth);app.provide('doctorNativeAvailability',readiness)
  let admission=0,disposed=false,active=true,monitor:ReturnType<typeof setTimeout>|undefined,expiry:ReturnType<typeof setTimeout>|undefined
  function stopMonitor(){if(monitor!==undefined)clearTimeout(monitor);if(expiry!==undefined)clearTimeout(expiry);monitor=undefined;expiry=undefined}
  function schedule(){
   stopMonitor()
   if(disposed||!active||!navigator.onLine||!backend||auth.state.phase!=='ready')return
   const delay=Math.max(1000,Math.min(30000,(auth.expiresAt()??Date.now())-Date.now()-15000))
   // A slow request cannot extend the current view past known token expiry.
   expiry=setTimeout(()=>{auth.lock();void admit()},Math.max(0,(auth.expiresAt()??Date.now())-Date.now()-1000))
   monitor=setTimeout(()=>{monitor=undefined;void auth.revalidate().finally(schedule)},delay)
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
     await auth.resume()
     if(!disposed&&revision===admission){readiness.value=auth.state.error==='storage'?'disabled':'enabled';await shell.retry()}
    }else{readiness.value='disabled';auth.lock()}
   }catch{if(!disposed&&revision===admission){readiness.value='disabled';auth.lock()}}
   finally{clearTimeout(timer)}
  }
  void admit()
  app.provide('doctorMobile',shell)
  const offline=()=>{admission++;stopMonitor();readiness.value=backend?'checking':'disabled';auth.lock();shell.connectivity(false)},online=()=>{shell.connectivity(true);void admit()}
  window.addEventListener('offline',offline);window.addEventListener('online',online)
  if (!navigator.onLine) offline()
  const subscriptions: {remove:()=>Promise<void>}[]=[]
  async function open(url:string){const destination=doctorMobileDestination(url);await shell.navigate(url);if(destination)await navigateTo(destination,{replace:true})}
  if (Capacitor.isNativePlatform()) {
    subscriptions.push(await App.addListener('appUrlOpen',event=>{void open(event.url)}))
    subscriptions.push(await App.addListener('backButton',()=>{if(app.$router.currentRoute.value.path!=='/workspace')void navigateTo('/workspace');else {auth.lock();shell.sessionChanged();void App.exitApp()}}))
    subscriptions.push(await App.addListener('appStateChange',event=>{active=event.isActive;if(event.isActive){void admit();if(!backend)void shell.retry()}else {admission++;stopMonitor();readiness.value=backend?'checking':'disabled';auth.lock();shell.sessionChanged()}}))
    const launch=await App.getLaunchUrl();if(launch)await open(launch.url)
  }
  app.vueApp.onUnmount(()=>{disposed=true;admission++;stopMonitor();auth.dispose();shell.dispose();window.removeEventListener('offline',offline);window.removeEventListener('online',online);for(const subscription of subscriptions)void subscription.remove()})
})
