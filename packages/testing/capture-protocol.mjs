const methods=Object.freeze(['Runtime.callFunctionOn','Runtime.evaluate','Page.getLayoutMetrics','Page.captureScreenshot'])
const blank=()=>Object.fromEntries(methods.map(method=>[method,{sent:0,received:0,failed:0,pending:0,longestMs:0}]))
/** Fixed method timings only. Never retain/emit protocol params, result bytes,
 * exception text, IDs, URLs, DOM values or session material. */
export function createCaptureProtocolObserver(now=()=>performance.now()){
 let active=false,seen=false,incomplete=false,counts=blank(),pending=new Map()
 const bounded=value=>Math.min(1_000_000,Math.max(0,Math.round(value)))
 const logger={
  isEnabled(name,severity){return active&&name==='protocol'&&severity==='verbose'},
  log(name,severity,message){
   if(!active||name!=='protocol'||severity!=='verbose')return
   seen=true
   if(typeof message!=='string'||message.length>4*1024*1024){incomplete=true;return}
   const sending=message.startsWith('SEND ► '),receiving=message.startsWith('◀ RECV ')
   if(!sending&&!receiving){incomplete=true;return}
   let value;try{value=JSON.parse(message.slice(7))}catch{incomplete=true;return}
   if(!value||typeof value!=='object'||!Number.isSafeInteger(value.id)||value.id<0)return
   if(sending){
    if(!methods.includes(value.method))return
    if(pending.size>=128||pending.has(value.id)){incomplete=true;return}
    counts[value.method].sent++;pending.set(value.id,{method:value.method,started:now()})
   }else{
    const tracked=pending.get(value.id);if(!tracked)return
    const elapsed=now()-tracked.started
    if(!Number.isFinite(elapsed)||elapsed<0){incomplete=true;pending.delete(value.id);return}
    const result=counts[tracked.method];result.received++;if(value.error!==undefined)result.failed++
    result.longestMs=Math.max(result.longestMs,bounded(elapsed));pending.delete(value.id)
   }
  },
 }
 return{logger,start(){active=true;seen=false;incomplete=false;counts=blank();pending=new Map()},stop(){
  active=false
  for(const tracked of pending.values()){const result=counts[tracked.method];result.pending++;const elapsed=now()-tracked.started;if(Number.isFinite(elapsed)&&elapsed>=0)result.longestMs=Math.max(result.longestMs,bounded(elapsed));else incomplete=true}
  const result={observed:seen,incomplete,methods:structuredClone(counts)};pending.clear();return result
 }}
}
