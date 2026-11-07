import {clinicalUuid,type ClinicalReleased} from './clinical.ts'
import {clinicalFailure,type ClinicalError} from './clinicalController.ts'
import type {clinicalReleaseRepository} from './clinicalReleaseRepository'
export interface ClinicalReleaseState {loading:boolean;pending:boolean;release:ClinicalReleased|null;error:ClinicalError}
export const clinicalReleaseState=():ClinicalReleaseState=>({loading:false,pending:false,release:null,error:null})
export function createClinicalReleaseController(repository:ReturnType<typeof clinicalReleaseRepository>|null,state:ClinicalReleaseState,identity:()=>{userId:string;sessionId:string}|null,environment:string,key=()=>crypto.randomUUID()){
 let generation=0,abort=new AbortController()
 const scope=()=>{const actor=identity();return actor?JSON.stringify(['doctor-suit',environment,actor.userId,actor.sessionId,'clinical-release']):null}
 function clear(){generation++;abort.abort();abort=new AbortController();Object.assign(state,clinicalReleaseState())}
 async function load(id:string){
  if(state.pending)return false;clear();const expected=generation,actor=scope();if(!repository||!actor||!clinicalUuid(id)){state.error='denied';return false}state.loading=true
  try{const value=await repository.load(id,AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]));if(expected!==generation||actor!==scope())return false;state.release=value;return true}
  catch(error){if(expected===generation&&actor===scope()){state.release=null;state.error=clinicalFailure(error)}return false}
  finally{if(expected===generation&&actor===scope())state.loading=false}
 }
 async function download(versionId:string){
  const release=state.release,actor=scope(),expected=generation;if(!repository||state.pending||!release||!actor||Date.parse(release.expires_at)<=Date.now())return null;state.pending=true
  try{const file=await repository.download(release,versionId,key(),AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]));return expected===generation&&actor===scope()?file:null}
  catch(error){if(expected===generation&&actor===scope()){state.error=clinicalFailure(error);if(state.error==='denied')state.release=null}return null}
  finally{if(expected===generation&&actor===scope())state.pending=false}
 }
 return {state,clear,load,download,scopeKey:scope}
}
