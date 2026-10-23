import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {mkdir,readFile,copyFile,writeFile} from 'node:fs/promises'
import {createHash}from'node:crypto'
const android=fileURLToPath(new URL('../android/',import.meta.url)),root=fileURLToPath(new URL('../../../../../',import.meta.url)),out=fileURLToPath(new URL('../../../../../.local/doctor-android/',import.meta.url))
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw new Error('Android execution requires the owned disposable GitHub runner')
execFileSync('./gradlew',['assembleDebug','--no-daemon'],{cwd:android,stdio:'inherit'})
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw new Error('Android candidate source changed during build')
const apk=android+'app/build/outputs/apk/debug/app-debug.apk',bytes=await readFile(apk)
await mkdir(out,{recursive:true});await copyFile(apk,out+'app-debug.apk')
await writeFile(out+'build-metadata.json',JSON.stringify({version:1,sourceHead,appId:'com.buildingsuit.doctor.synthetic',variant:'debug',apkSha256:createHash('sha256').update(bytes).digest('hex'),syntheticOnly:true,clinicalAuthority:false,externalDistribution:false},null,2)+'\n')
