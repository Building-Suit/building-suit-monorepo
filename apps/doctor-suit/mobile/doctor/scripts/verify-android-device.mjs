import{spawnSync}from'node:child_process'
import{fileURLToPath}from'node:url'
if(process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true')throw new Error('Owned CI emulator required')
let failed=false
// Both scripts enforce their own exact-candidate guard and owned cleanup. An
// earlier failed shell journey cannot suppress independent vault evidence.
for(const file of['verify-android.mjs','verify-session-vault.mjs']){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url))],{stdio:'inherit'})
 if(result.status!==0)failed=true
}
if(failed)process.exitCode=1
