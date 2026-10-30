export const nativeOnlineFreshnessMilliseconds=40000
export type NativeOnlineLockReason='starting'|'background'|'offline'|'expired'|'session'
export interface NativeOnlinePolicyState {active:boolean;online:boolean;admitted:boolean;revision:number;reason:NativeOnlineLockReason|null}
/** This is a memory admission limit, not approval to cache private data. The
 * existing Keystore credential exception is independent of this lease. */
export function createNativeOnlinePolicy(clearProtected:(reason:NativeOnlineLockReason)=>void,
 options:{now?:()=>number;schedule?:(task:()=>void,delay:number)=>unknown;cancel?:(timer:unknown)=>void;state?:NativeOnlinePolicyState}={}){
 const state=options.state??{active:true,online:true,admitted:false,revision:0,reason:'starting'},now=options.now??(()=>performance.now())
 const schedule=options.schedule??((task,delay)=>setTimeout(task,delay)),cancel=options.cancel??(timer=>clearTimeout(timer as ReturnType<typeof setTimeout>))
 let timer:unknown,deadline:number|null=null,disposed=false,lease=0
 function stop(){lease++;if(timer!==undefined)cancel(timer);timer=undefined;deadline=null;state.admitted=false}
 function invalidate(reason:NativeOnlineLockReason){stop();state.revision++;state.reason=reason;clearProtected(reason)}
 function forget(){stop();state.revision++;state.reason='session'}
 function setActive(active:boolean){if(disposed||state.active===active)return;state.active=active;invalidate('background')}
 function setOnline(online:boolean){if(disposed||state.online===online)return;state.online=online;invalidate('offline')}
 function grant(revision:number){
  if(disposed||revision!==state.revision||!state.active||!state.online)return false
  const clock=now();if(!Number.isFinite(clock)){invalidate('expired');return false}
  stop();deadline=clock+nativeOnlineFreshnessMilliseconds;state.admitted=true;state.reason=null
  const currentLease=lease
  timer=schedule(()=>{if(disposed||state.revision!==revision||lease!==currentLease)return;timer=undefined;invalidate('expired')},nativeOnlineFreshnessMilliseconds)
  return true
 }
 function admitted(){if(disposed||!state.admitted||!state.active||!state.online)return false;const clock=now();if(!Number.isFinite(clock)||deadline===null||clock>=deadline){invalidate('expired');return false};return true}
 function dispose(){if(disposed)return;disposed=true;invalidate('session')}
 return{state,capture:()=>state.revision,grant,admitted,setActive,setOnline,forget,dispose}
}
