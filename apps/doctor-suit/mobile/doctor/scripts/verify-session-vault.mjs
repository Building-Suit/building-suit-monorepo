import{execFileSync}from'node:child_process'
import{readFile,writeFile,mkdir}from'node:fs/promises'
import{createHash}from'node:crypto'
import{nativeVaultEvidence}from'./native-vault-evidence.mjs'
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw new Error('Owned CI emulator required')
const api=Number(process.env.DOCTOR_ANDROID_API)
if(![29,36].includes(api))throw new Error('Unregistered Android API')
const directory='.local/doctor-android/',metadata=JSON.parse(await readFile(directory+'build-metadata.json','utf8'))
const run=(command,args,timeout=90000)=>execFileSync(command,args,{encoding:'utf8',timeout,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}).trim()
const head=run('git',['rev-parse','HEAD']),app='com.buildingsuit.doctor.synthetic'
if(metadata.sourceHead!==head||metadata.appId!==app||metadata.variant!=='debug'||metadata.syntheticOnly!==true||metadata.clinicalAuthority!==false||metadata.externalDistribution!==false)throw new Error('Session vault candidate mismatch')
for(const[name,key]of[['app-debug.apk','apkSha256'],['app-debug-androidTest.apk','testApkSha256']])if(createHash('sha256').update(await readFile(directory+name)).digest('hex')!==metadata[key])throw new Error('Session vault APK mismatch')
const devices=run('adb',['devices']).split('\n').map(line=>/^(emulator-\d+)\s+device$/.exec(line.trim())?.[1]).filter(Boolean)
if(devices.length!==1)throw new Error('Exactly one owned emulator required')
const adb=args=>run('adb',['-s',devices[0],...args])
if(Number(adb(['shell','getprop','ro.build.version.sdk']))!==api)throw new Error('Session vault API mismatch')
const cases=['fresh-install-empty','ciphertext-roundtrip','tamper-denied','namespace-denied','purge-marker','seed-before-reinstall','fresh-after-reinstall'].map(id=>({id,status:'unrun'}))
let stage='install',cleanup
const issues=new Set()
function instrument(className,expected){
 let output,completed=true
 try{output=adb(['shell','am','instrument','-w','-r','-e','class',app+'.'+className,app+'.test/androidx.test.runner.AndroidJUnitRunner'])}
 catch(error){completed=false;issues.add('native-process-failed');output=typeof error?.stdout==='string'?error.stdout:''}
 const result=nativeVaultEvidence(output,app+'.'+className,expected)
 for(const row of result.cases)cases.find(item=>item.id===row.id).status=row.status
 for(const issue of result.issues)issues.add(issue)
 if(!completed||!result.accepted)throw new Error('Native vault assertion failed')
}
try{
 adb(['install','-r',directory+'app-debug.apk']);adb(['install','-r',directory+'app-debug-androidTest.apk']);adb(['shell','pm','clear',app])
 stage=cases[0].id;instrument('DoctorSessionFreshInstallTest',[{method:'freshInstallEmpty',id:cases[0].id}])
 stage='vault-suite';instrument('DoctorSessionVaultTest',['ciphertextRoundTrip','tamperPurgesSession','otherNamespacesDenied','purgeMarkerDefeatsRestoredCiphertext'].map((method,index)=>({method,id:cases[index+1].id})))
 stage=cases[5].id;instrument('DoctorSessionSeedTest',[{method:'seedBeforeReinstall',id:cases[5].id}])
 adb(['uninstall',app+'.test']);adb(['uninstall',app]);adb(['install','-r',directory+'app-debug.apk']);adb(['install','-r',directory+'app-debug-androidTest.apk'])
 stage=cases[6].id;instrument('DoctorSessionFreshInstallTest',[{method:'freshInstallEmpty',id:cases[6].id}]);stage='complete'
}catch{
 const failed=cases.find(item=>item.id===stage);if(failed&&failed.status==='unrun')failed.status='failed'
 process.exitCode=1;console.error('Synthetic native vault verification failed at '+stage)
}finally{
 try{adb(['shell','am','force-stop',app]);adb(['uninstall',app+'.test']);adb(['uninstall',app]);cleanup='passed'}catch{cleanup='failed';process.exitCode=1}
 const receipt={version:1,task:'DOS-M4-003',sourceHead:head,apkSha256:metadata.apkSha256,testApkSha256:metadata.testApkSha256,api,cases,stage,cleanup,issues:[...issues].sort(),accepted:stage==='complete'&&cleanup==='passed'&&issues.size===0&&cases.every(item=>item.status==='passed'),runner:'owned-disposable-android-emulator',physicalDevice:false,syntheticOnly:true,clinicalApproval:false,offlineChartApproval:false}
 await mkdir('test-results/doctor-mobile',{recursive:true});await writeFile('test-results/doctor-mobile/session-vault-'+api+'.json',JSON.stringify(receipt,null,2)+'\n')
 console.log('Synthetic native vault receipt '+JSON.stringify(receipt))
}
