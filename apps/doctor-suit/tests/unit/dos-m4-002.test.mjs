import {androidRuntimeDiagnostics} from '../../mobile/doctor/scripts/android-diagnostics.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createDoctorMobileShell,doctorMobileDestination} from '../../mobile/doctor/app/utils/mobileShell.ts'
const id=n=>`d4020000-0000-4000-8000-${String(n).padStart(12,'0')}`
function fixture(){
 const identity={userId:id(1),sessionId:id(2),environment:'local'},selection={doctorId:id(3),practiceId:id(4),locationId:id(5)}
 const value=()=>({...identity,...selection,contractVersion:1,product:'doctor-suit',dataMode:'synthetic',portal:'secretary',grantsVersion:1,locationVersion:1,capabilities:['appointments.read']})
 const port={identity:()=>identity,selection:()=>selection,load:async()=>value()}
 return{identity,selection,value,port,shell:createDoctorMobileShell(port)}
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
test('cold Android deep link retains the intended screen while signed out; only fresh validated context opens it',async()=>{
 const f=fixture();let signedIn=false;f.port.identity=()=>signedIn?f.identity:null
 assert.equal(await f.shell.navigate('doctor-suit-synthetic://schedule'),false)
 assert.equal(f.shell.state.phase,'signed-out');assert.equal(f.shell.state.route,'/schedule');assert.equal(f.shell.state.context,null)
 signedIn=true;assert.equal(await f.shell.retry(),true);assert.equal(f.shell.state.phase,'ready');assert.equal(f.shell.state.context.practiceId,f.selection.practiceId)
})
test('external, encoded, token-bearing and unknown navigation cannot reach a context adapter',async()=>{
 const f=fixture();f.port.load=()=>assert.fail('rejected navigation must not query')
 for(const path of ['https://example.test','//workspace','/workspace?token=synthetic','/workspace#schedule','/%2e%2e/account','doctor-suit-synthetic://other','/patients']){
  assert.equal(doctorMobileDestination(path),null);assert.equal(await f.shell.navigate(path),false);assert.equal(f.shell.state.context,null);assert.equal(f.shell.state.phase,'denied')
 }
})
test('unsupported server versions, wrong products and extra credential fields fail without private projections',async()=>{
 for(const patch of [{contractVersion:2},{product:'shop-suit'},{environment:'production'},{dataMode:'live'},{token:'private sentinel'}]){
  const f=fixture();f.port.load=async()=>({...f.value(),...patch});assert.equal(await f.shell.navigate('/workspace'),false);assert.equal(f.shell.state.phase,'error');assert.equal(f.shell.state.context,null)
  assert.equal(JSON.stringify(f.shell.state).includes('sentinel'),false)
 }
})
test('matching identity and session do not permit a different doctor, practice or clinic',async()=>{
 for(const key of ['userId','sessionId','doctorId','practiceId','locationId']){
  const f=fixture();f.port.load=async()=>({...f.value(),[key]:id(90)});assert.equal(await f.shell.navigate('/workspace'),false);assert.equal(f.shell.state.context,null)
 }
})
test('secretary portal alone grants no scheduling capability',async()=>{
 const f=fixture();f.port.load=async()=>({...f.value(),capabilities:[]});assert.equal(await f.shell.navigate('/schedule'),false);assert.equal(f.shell.state.phase,'denied');assert.equal(f.shell.state.context,null)
})
test('changing selected practice during a read discards the previous context',async()=>{
 const f=fixture(),d=deferred(),old=f.value();f.port.load=()=>d.promise
 const read=f.shell.navigate('/workspace');assert.equal(f.shell.state.phase,'loading');f.selection.practiceId=id(8);d.resolve(old)
 assert.equal(await read,false);assert.equal(f.shell.state.context,null);assert.equal(f.shell.state.phase,'denied')
})
test('session replacement during a read requires a new check',async()=>{
 const f=fixture(),d=deferred(),old=f.value();f.port.load=()=>d.promise
 const read=f.shell.navigate('/workspace');f.identity.sessionId=id(9);d.resolve(old)
 assert.equal(await read,false);assert.equal(f.shell.state.phase,'signed-out');assert.equal(f.shell.state.context,null)
})
test('late responses cannot replace the newer selected destination',async()=>{
 const f=fixture(),old=deferred();f.port.load=()=>old.promise;const first=f.shell.navigate('/schedule')
 f.port.load=async()=>f.value();assert.equal(await f.shell.navigate('/account'),true);old.resolve(f.value());assert.equal(await first,false)
 assert.equal(f.shell.state.route,'/account');assert.equal(f.shell.state.phase,'ready')
})
test('fresh denial clears an earlier valid context and does not expose server exception text',async()=>{
 const f=fixture();assert.equal(await f.shell.navigate('/schedule'),true)
 f.port.load=async()=>{throw{code:'42501',message:'private server sentinel'}}
 assert.equal(await f.shell.retry(),false);assert.equal(f.shell.state.phase,'denied');assert.equal(f.shell.state.context,null);assert.equal(JSON.stringify(f.shell.state).includes('sentinel'),false)
})
test('offline and account lifecycle changes clear context and prevent resurrection',async()=>{
 const f=fixture();assert.equal(await f.shell.navigate('/workspace'),true);f.shell.connectivity(false);assert.equal(f.shell.state.context,null);assert.equal(f.shell.state.phase,'offline')
 assert.equal(await f.shell.navigate('/schedule'),false);f.shell.connectivity(true);assert.equal(f.shell.state.phase,'signed-out');assert.equal(f.shell.state.context,null)
 assert.equal(await f.shell.retry(),true);f.shell.sessionChanged();assert.equal(f.shell.state.context,null);assert.equal(f.shell.state.phase,'signed-out')
})
test('disposing an in-flight native shell aborts its own request and retains no context',async()=>{
 const f=fixture(),d=deferred();let signal;f.port.load=(_route,_scope,value)=>{signal=value;return d.promise};const read=f.shell.navigate('/workspace');f.shell.dispose();assert.equal(signal.aborted,true);d.resolve(f.value());assert.equal(await read,false);assert.equal(f.shell.state.context,null)
})

test('a rejected native destination remains denied across resume/reconnect until explicit valid navigation',async()=>{
 const f=fixture();assert.equal(await f.shell.navigate('/schedule'),true)
 assert.equal(await f.shell.navigate('doctor-suit-synthetic://patients'),false)
 assert.equal(f.shell.state.phase,'denied');assert.equal(f.shell.state.context,null)
 f.shell.sessionChanged();assert.equal(await f.shell.retry(),false);assert.equal(f.shell.state.phase,'denied')
 f.shell.connectivity(false);f.shell.connectivity(true);assert.equal(await f.shell.retry(),false);assert.equal(f.shell.state.phase,'denied')
 assert.equal(await f.shell.navigate('/account'),true);assert.equal(f.shell.state.route,'/account');assert.equal(await f.shell.retry(),true)
})

test('Android failure receipts retain bounded engine/category facts without private emulator strings',()=>{
 const result=androidRuntimeDiagnostics('Current WebView package (name, version): (com.google.android.webview, 149.0.7) private sentinel','Uncaught SyntaxError: private sentinel https://example.test/private-token; Content Security Policy','<node package="com.buildingsuit.doctor.synthetic" class="android.webkit.WebView" text="private sentinel"/>')
 assert.deepEqual(result,{webviewMajor:149,clientIssues:['client-syntax-error','client-content-policy'],webviewVisible:true,syntheticPackageVisible:true})
 assert.equal(JSON.stringify(result).includes('sentinel'),false);assert.equal(JSON.stringify(result).includes('https:'),false)
 assert.equal(androidRuntimeDiagnostics('Current WebView package (name, version): (secret, 12345.0)',null,null).webviewMajor,null)
 assert.deepEqual(androidRuntimeDiagnostics(null,null,null),{webviewMajor:null,clientIssues:[],webviewVisible:false,syntheticPackageVisible:false})
})
