import {onMounted,onBeforeUnmount} from 'vue'
/** Clear transient sensitive UI state before document history snapshots and unmounts. */
export function usePageExitCleanup(clear:()=>void) {
 onMounted(()=>window.addEventListener('pagehide',clear))
 onBeforeUnmount(()=>{window.removeEventListener('pagehide',clear);clear()})
}
