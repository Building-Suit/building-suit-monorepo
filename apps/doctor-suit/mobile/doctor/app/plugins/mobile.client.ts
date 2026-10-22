import {App} from '@capacitor/app'
import {Capacitor} from '@capacitor/core'
import {createDoctorMobileShell,doctorMobileDestination,type MobileShellState} from '../utils/mobileShell'
export default defineNuxtPlugin(async app=>{
  // Native sessions remain unavailable until task003's reviewed storage adapter.
  const state=reactive<MobileShellState>({phase:'signed-out',route:'/workspace',context:null})
  const shell=createDoctorMobileShell({identity:()=>null,selection:()=>null,load:async()=>{throw new Error('Unavailable')}},state)
  app.provide('doctorMobile',shell)
  const offline=()=>shell.connectivity(false),online=()=>{shell.connectivity(true);void shell.retry()}
  window.addEventListener('offline',offline);window.addEventListener('online',online)
  if (!navigator.onLine) offline()
  const subscriptions: {remove:()=>Promise<void>}[]=[]
  async function open(url:string){const destination=doctorMobileDestination(url);await shell.navigate(url);if(destination)await navigateTo(destination,{replace:true})}
  if (Capacitor.isNativePlatform()) {
    subscriptions.push(await App.addListener('appUrlOpen',event=>{void open(event.url)}))
    subscriptions.push(await App.addListener('backButton',()=>{if(shell.state.route!=='/workspace')void navigateTo('/workspace');else {shell.sessionChanged();void App.exitApp()}}))
    subscriptions.push(await App.addListener('appStateChange',event=>{if(event.isActive)void shell.retry();else shell.sessionChanged()}))
    const launch=await App.getLaunchUrl();if(launch)await open(launch.url)
  }
  app.vueApp.onUnmount(()=>{shell.dispose();window.removeEventListener('offline',offline);window.removeEventListener('online',online);for(const subscription of subscriptions)void subscription.remove()})
})
