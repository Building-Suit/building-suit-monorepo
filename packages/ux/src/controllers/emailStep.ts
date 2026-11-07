export type EmailStepError='invalid'|'rejected'|'rate-limit'|'network'|null
export interface EmailStepState{pending:boolean;approved:boolean;email:string;error:EmailStepError}
export const emailStepState=():EmailStepState=>({pending:false,approved:false,email:'',error:null})
export function normalizedAuthEmail(value:string){return value.trim().toLowerCase()}
export function validAuthEmail(value:string){return value.length>0&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}
export function emailStepDelay(signal: AbortSignal, milliseconds = 320): Promise<void> {
 return new Promise((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return }
  const finish = () => { signal.removeEventListener('abort', cancel); resolve() }
  const timer = setTimeout(finish, milliseconds)
  function cancel() { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(signal.reason) }
  signal.addEventListener('abort', cancel, { once: true })
 })
}
/** Product owns lookup meaning/copy; shared interaction fences stale checks. */
export function createEmailStepController(state:EmailStepState,current:()=>string,lookup:(email:string,signal:AbortSignal)=>Promise<boolean>,wait:(signal:AbortSignal)=>Promise<void>=async()=>{}){
 let generation=0,abort=new AbortController()
 function reset(){generation++;abort.abort();abort=new AbortController();Object.assign(state,emailStepState())}
 async function check(){
  if(state.pending)return false
  const email=normalizedAuthEmail(current());reset()
  if(!validAuthEmail(email)){state.error='invalid';return false}
  const g=generation;state.pending=true;state.email=email
  const active=()=>g===generation&&email===normalizedAuthEmail(current())
  try{const[allowed]=await Promise.all([lookup(email,AbortSignal.any([abort.signal,AbortSignal.timeout(8000)])),wait(abort.signal)]);if(!active())return false;if(typeof allowed!=='boolean')throw new Error('Invalid email-step response');state.approved=allowed;state.error=allowed?null:'rejected';return allowed}
  catch(e){if(active()){const status=e&&typeof e==='object'&&'statusCode'in e?Number(e.statusCode):e&&typeof e==='object'&&'status'in e?Number(e.status):0;state.error=status===429?'rate-limit':'network'}return false}
  finally{if(g===generation)state.pending=false}
 }
 return{state,reset,check}
}
