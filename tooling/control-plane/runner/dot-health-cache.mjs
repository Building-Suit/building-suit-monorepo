import {recordEgress} from './dot-egress-telemetry.mjs'
export function createHealthCache({load,root,now=Date.now}){
 let snapshot=null,error=null,inflight=null
 return {
 async refresh(){if(inflight)return inflight;recordEgress('health',{cache_misses:1},root);inflight=(async()=>{try{const next=await load();if(!snapshot||Date.parse(next.collected_at)>=Date.parse(snapshot.collected_at))snapshot=next;error=null}catch{error='Health collection unavailable; retained observations may be stale'}finally{inflight=null}})();return inflight},
 publish(value){if(!snapshot||Date.parse(value.collected_at)>=Date.parse(snapshot.collected_at))snapshot={...snapshot,...value,alerts:value.alerts??snapshot?.alerts??[]};error=null},
 read(){recordEgress('health',{cache_hits:1},root);return {...(snapshot??{rows:[],alerts:[],collected_at:null}),collector_error:error??(!snapshot?'Initial health collection pending':null),cache_age_seconds:snapshot?.collected_at?Math.max(0,(now()-Date.parse(snapshot.collected_at))/1000):null,llm_used:false}},
 }
}
