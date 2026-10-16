import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
const source=new URL('../../packages/ui/src/utils/appointmentReminderEmail.ts',import.meta.url)
const target=new URL('../../apps/shop-suit/supabase/functions/_shared/generated/appointmentReminderEmail.ts',import.meta.url)
const generated='// GENERATED deployment artifact from packages/ui/src/utils/appointmentReminderEmail.ts.\n// Regenerate with node tooling/ui/build-appointment-reminder-email.mjs; do not edit.\n'+readFileSync(source,'utf8')
if(process.argv.slice(2).some(arg=>arg!=='--check'))throw Error('Expected optional --check')
if(process.argv.includes('--check')){
 if(readFileSync(target,'utf8')!==generated)throw Error('Reminder email deployment artifact is stale; regenerate from packages/ui')
}else{mkdirSync(new URL('./',target),{recursive:true});writeFileSync(target,generated)}
