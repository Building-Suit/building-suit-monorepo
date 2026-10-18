import{readFileSync,existsSync}from'node:fs'
import{parseEnv}from'node:util'
import{fileURLToPath}from'node:url'
import{doctorAuthSetupReport,doctorVerifyAuthSetup}from'../../apps/doctor-suit/app/utils/authDiagnostics.ts'
const args=process.argv.slice(2)
if(args.some(v=>!['--runtime','--verify'].includes(v))){console.error('Usage: pnpm doctor:auth-check [--runtime] [--verify]');process.exitCode=1}
else{
 try{
  const path=fileURLToPath(new URL('../../apps/doctor-suit/.env',import.meta.url))
  const values={...(existsSync(path)?parseEnv(readFileSync(path,'utf8')):{}),...process.env}
  const report=args.includes('--verify')?await doctorVerifyAuthSetup(values,args.includes('--runtime')):doctorAuthSetupReport(values,args.includes('--runtime'))
  console.log(JSON.stringify(report,null,2))
  if(!report.configured||(args.includes('--verify')&&report.marker!=='verified'))process.exitCode=1
 }catch{console.error('Doctor auth setup could not be read. Check the .env file syntax. Values and credentials are omitted.');process.exitCode=1}
}
