import {onMounted,onBeforeUnmount,watch,type Ref} from 'vue'
/** Invalidate even pre-session work on suspension and revalidate after it settles. */
export function usePrivateSessionLifecycle(expiresAt:Ref<string|null>,busy:Ref<boolean>,actions:{clear:()=>void;suspend:()=>void;expire:()=>void;refresh:()=>Promise<void>}) {
 let deadline:ReturnType<typeof setTimeout>|undefined,poll:ReturnType<typeof setInterval>|undefined,resumePending=false
 const cancel=()=>{if(deadline!==undefined)clearTimeout(deadline);deadline=undefined}
 function arm(){cancel();if(!expiresAt.value)return;const delay=Date.parse(expiresAt.value)-Date.now();if(!Number.isFinite(delay)||delay<=0){actions.expire();return}deadline=setTimeout(actions.expire,Math.min(delay,600000))}
 function resume(){
  if(!resumePending||document.hidden||busy.value)return
  resumePending=false
  if(expiresAt.value&&Date.parse(expiresAt.value)<=Date.now()){actions.expire();return}
  void actions.refresh()
 }
 function refresh(){resume();if(!expiresAt.value||document.hidden||busy.value)return;if(Date.parse(expiresAt.value)<=Date.now()){actions.expire();return}actions.clear();void actions.refresh()}
 function visibility(){if(document.hidden){resumePending=true;actions.suspend()}else resume()}
 const stop=watch(expiresAt,arm,{flush:'sync'})
 const stopBusy=watch(busy,pending=>{if(!pending)resume()},{flush:'post'})
 onMounted(()=>{arm();poll=setInterval(refresh,15000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visibility);if(document.hidden)visibility()})
 onBeforeUnmount(()=>{stop();stopBusy();cancel();if(poll!==undefined)clearInterval(poll);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibility)})
}
