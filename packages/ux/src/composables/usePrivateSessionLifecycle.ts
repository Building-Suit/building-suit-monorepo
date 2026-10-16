import {onMounted,onBeforeUnmount,watch,type Ref} from 'vue'
/** Revalidate visible private views; never preserve their contents across suspension. */
export function usePrivateSessionLifecycle(expiresAt:Ref<string|null>,busy:Ref<boolean>,actions:{clear:()=>void;expire:()=>void;refresh:()=>Promise<void>}) {
 let deadline:ReturnType<typeof setTimeout>|undefined,poll:ReturnType<typeof setInterval>|undefined
 const cancel=()=>{if(deadline!==undefined)clearTimeout(deadline);deadline=undefined}
 function arm(){cancel();if(!expiresAt.value)return;const delay=Date.parse(expiresAt.value)-Date.now();if(!Number.isFinite(delay)||delay<=0){actions.expire();return}deadline=setTimeout(actions.expire,Math.min(delay,600000))}
 function refresh(){if(!expiresAt.value||document.hidden||busy.value)return;if(Date.parse(expiresAt.value)<=Date.now()){actions.expire();return}actions.clear();void actions.refresh()}
 function visibility(){if(!expiresAt.value)return;if(document.hidden)actions.clear();else refresh()}
 const stop=watch(expiresAt,arm,{flush:'sync'})
 onMounted(()=>{arm();poll=setInterval(refresh,15000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visibility)})
 onBeforeUnmount(()=>{stop();cancel();if(poll!==undefined)clearInterval(poll);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibility)})
}
