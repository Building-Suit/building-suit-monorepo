import type {DoctorMobileContext, DoctorMobileIdentity} from '@building-suit/contracts'
import type {NativeContextChoice, NativeContextPort} from './nativeContext.ts'
import {nativePatientScopeKey} from './nativePatients.ts'
import {nativeSessionConfiguration, type NativeSessionConfiguration, type NativeAuthTransport} from './nativeSessionBackend.ts'
const denied = () => Object.assign(new Error('Current scoped access required'), {code:'42501'})
/** Owning native adapters supply fixed RPC names. Each operation obtains fresh
 * server scope; the selected portal and local capability flags grant no rights. */
export function createNativeScopedRpc(configuration: NativeSessionConfiguration, transport: NativeAuthTransport,
  session: {identity(): DoctorMobileIdentity | null; accessToken(): string | null}, current: () => NativeContextChoice | null, contexts: NativeContextPort, rejectScope: () => void) {
  const config=nativeSessionConfiguration(configuration)
  if(!config)throw denied()
  return async function rpc(name:string,args:Record<string,unknown>,scope:DoctorMobileContext,signal:AbortSignal,capability:string|null='patients.read',maxBytes=262144):Promise<unknown> {
    const choice=current(),actor=session.identity(),token=session.accessToken(),key=nativePatientScopeKey(scope)
    if(!/^doctor_[a-z_]+$/.test(name)||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8388608||!choice||!actor||!token||signal.aborted||nativePatientScopeKey(choice.context)!==key||actor.userId!==scope.userId||actor.sessionId!==scope.sessionId||actor.environment!=='local'||(capability&&!scope.capabilities.includes(capability)))throw denied()
    const fresh=await contexts.resolve(choice,actor,signal)
    if(nativePatientScopeKey(fresh.context)!==key){rejectScope();throw denied()}
    const accepts=()=>!signal.aborted&&session.accessToken()===token&&nativePatientScopeKey(current()?.context??null)===key
    if(!accepts())throw denied()
    const response=await transport({url:config!.url+'/rest/v1/rpc/'+name,method:'POST',signal,
      headers:{apikey:config!.publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:{...args,p_practice:scope.practiceId,p_location:scope.locationId}})
    if(!accepts())throw denied()
    if([401,403].includes(response.status))throw denied()
    if(!Number.isInteger(response.status)||response.status<200||response.status>=300){
      const raw=response.data,code=raw&&typeof raw==='object'&&'code'in raw?raw.code:null
      if(['40001','42501','22023'].includes(String(code)))throw Object.assign(new Error('Scoped request rejected'),{code})
      if(response.status===409)throw Object.assign(new Error('Scoped version conflict'),{code:'40001'})
      throw new Error('Scoped service unavailable')
    }
    if(JSON.stringify(response.data??null).length>maxBytes)throw new Error('Scoped response unavailable')
    return response.data
  }
}
