import{Capacitor,CapacitorHttp}from'@capacitor/core'
import type{NativeAuthTransport}from'./nativeSessionBackend'
export const nativeAuthTransport:NativeAuthTransport=async request=>{
 if(Capacitor.getPlatform()!=='android'||request.signal.aborted)throw new Error('Connection unavailable')
 let cancel!:()=>void,timer:ReturnType<typeof setTimeout>|undefined
 const interrupted=new Promise<never>((_,reject)=>{
  cancel=()=>reject(new Error('Connection unavailable'))
  request.signal.addEventListener('abort',cancel,{once:true});timer=setTimeout(cancel,10000)
 })
 try{
  // Native transport is bounded and refuses redirects. Underlying Android I/O
  // has its own eight-second timeouts; stale replies cannot restore authority.
  const result=await Promise.race([CapacitorHttp.request({url:request.url,method:request.method,headers:request.headers,data:request.body,responseType:'json',connectTimeout:8000,readTimeout:8000,disableRedirects:true}),interrupted])
  if(request.signal.aborted)throw new Error('Connection unavailable')
  return{status:result.status,data:result.data}
 }finally{request.signal.removeEventListener('abort',cancel);if(timer!==undefined)clearTimeout(timer)}
}
