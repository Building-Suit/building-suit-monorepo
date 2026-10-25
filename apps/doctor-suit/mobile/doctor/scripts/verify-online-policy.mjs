import{execFileSync}from'node:child_process'
import{readFile,writeFile,mkdir}from'node:fs/promises'
import{createHash}from'node:crypto'
import{nativeVaultEvidence}from'./native-vault-evidence.mjs'
import{nativePolicyCases}from'./policy-case-manifest.mjs'
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw new Error('Owned CI emulator required')
const api=Number(process.env.DOCTOR_ANDROID_API)
if(![29,36].includes(api))throw new Error('Unregistered Android API')
const directory='.local/doctor-android/',metadata=JSON.parse(await readFile(directory+'build-metadata.json','utf8'))
const run=(command,args,timeout=90000)=>execFileSync(command,args,{encoding:'utf8',timeout,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}).trim()
const head=run('git',['rev-parse','HEAD']),app='com.buildingsuit.doctor.synthetic'
if(metadata.sourceHead!==head||metadata.appId!==app||metadata.variant!=='debug'||metadata.syntheticOnly!==true||metadata.clinicalAuthority!==false||metadata.externalDistribution!==false)throw new Error('Online policy candidate mismatch')
for(const[name,key]of[['app-debug.apk','apkSha256'],['app-debug-androidTest.apk','testApkSha256']])if(createHash('sha256').update(await readFile(directory+name)).digest('hex')!==metadata[key])throw new Error('Online policy APK mismatch')
const devices=run('adb',['devices']).split('\n').map(line=>/^(emulator-\d+)\s+device$/.exec(line.trim())?.[1]).filter(Boolean)
if(devices.length!==1)throw new Error('Exactly one owned emulator required')
const adb=args=>run('adb',['-s',devices[0],...args])
if(Number(adb(['shell','getprop','ro.build.version.sdk']))!==api)throw new Error('Online policy API mismatch')
let stage='install',cleanup,cases=nativePolicyCases.map(value=>({id:value.id,status:'unrun'}))
const issues=new Set()
try{
 adb(['install','-r',directory+'app-debug.apk']);adb(['install','-r',directory+'app-debug-androidTest.apk']);adb(['shell','pm','clear',app])
 stage='online-policy-suite'
 let output,completed=true
 try{output=adb(['shell','am','instrument','-w','-r','-e','class',app+'.DoctorOnlinePolicyTest',app+'.test/androidx.test.runner.AndroidJUnitRunner'])}
 catch(error){completed=false;issues.add('native-process-failed');output=typeof error?.stdout==='string'?error.stdout:''}
 const evidence=nativeVaultEvidence(output,app+'.DoctorOnlinePolicyTest',nativePolicyCases)
 cases=evidence.cases;for(const issue of evidence.issues)issues.add(issue)
 if(!completed||!evidence.accepted)throw new Error('Online policy assertions failed')
 stage='complete'
}catch{for(const value of cases)if(value.status==='unrun')value.status='interrupted';process.exitCode=1;console.error('Synthetic native online policy failed at '+stage)}
finally{
 try{adb(['shell','am','force-stop',app]);adb(['uninstall',app+'.test']);adb(['uninstall',app]);cleanup='passed'}catch{cleanup='failed';process.exitCode=1}
 const receipt={version:1,task:'DOS-M4-010',sourceHead:head,appId:app,apkSha256:metadata.apkSha256,testApkSha256:metadata.testApkSha256,api,cases,stage,cleanup,issues:[...issues].sort(),scope:'native-policy-subset',taskAcceptance:false,physicalDeviceAcceptance:false,policySubsetAccepted:stage==='complete'&&cleanup==='passed'&&issues.size===0&&cases.every(value=>value.status==='passed'),runner:'owned-disposable-android-emulator',physicalDevice:false,syntheticOnly:true,clinicalApproval:false,offlineChartApproval:false,storeUpload:false}
 await mkdir('test-results/doctor-mobile',{recursive:true});await writeFile('test-results/doctor-mobile/online-policy-'+api+'.json',JSON.stringify(receipt,null,2)+'\n')
 console.log('Synthetic native online policy receipt '+JSON.stringify(receipt))
}
