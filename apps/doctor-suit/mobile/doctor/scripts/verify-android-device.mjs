import{spawnSync}from'node:child_process'
import{fileURLToPath}from'node:url'
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw new Error('Owned CI emulator required')
let failed=false
// Each script enforces its own exact-candidate guard and owned cleanup. An
// earlier failed journey cannot suppress independent vault or cache evidence.
for(const file of['verify-android.mjs','verify-session-vault.mjs','verify-online-policy.mjs']){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{stdio:'inherit'})
 if(result.status!==0)failed=true
}
if(failed)process.exitCode=1
