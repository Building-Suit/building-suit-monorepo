import {onMounted,onBeforeUnmount} from 'vue'
/** Public pages must revalidate server authorization after a browser BFCache restore. */
export function useFreshPageOnRestore() {
 const refresh=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload()}
 onMounted(()=>window.addEventListener('pageshow',refresh))
 onBeforeUnmount(()=>window.removeEventListener('pageshow',refresh))
}
