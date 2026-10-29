/** Bounded native operations use APIs available in the registered stock
 * renderer. No global polyfill, transport fallback or unbounded retry. */
export function nativeOperationSignal(parent:AbortSignal,milliseconds=10000):AbortSignal{
 if(!Number.isSafeInteger(milliseconds)||milliseconds<1||milliseconds>300000)throw new Error('Invalid native operation deadline')
 const controller=new AbortController()
 if(parent.aborted){controller.abort();return controller.signal}
 const stop=()=>{parent.removeEventListener('abort',stop);clearTimeout(timer);controller.abort()}
 const timer=setTimeout(stop,milliseconds)
 // Node-based protocol checks do not keep a process alive for a retired view.
 // Browser timer handles have no unref method.
 ;(timer as unknown as {unref?:()=>void}).unref?.()
 parent.addEventListener('abort',stop,{once:true})
 return controller.signal
}
export function nativeCommandKey():string{
 const bytes=new Uint8Array(16)
 // Fail rather than substituting a non-cryptographic nonce.
 globalThis.crypto.getRandomValues(bytes)
 bytes[6]=(bytes[6]!&15)|64;bytes[8]=(bytes[8]!&63)|128
 const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
