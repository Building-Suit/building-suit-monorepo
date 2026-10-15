import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const suites=await Promise.all(['shop_eta_submission.sql','shop_eta_einvoice.sql'].map(name=>readFile(new URL('../../apps/shop-suit/supabase/tests/'+name,import.meta.url),'utf8')))
const result=spawnSync('docker',['exec','-i','supabase_db_building-suit-shop','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input:`BEGIN;\n${suites.join('\n')}\nROLLBACK;`,encoding:'utf8'})
if(result.status!==0){console.error(result.stderr||result.error);process.exitCode=1}else console.log('Invoice queue, B2C/channel isolation, permissions, idempotency, immutable signed body, 202/provider IDs and original-reference contract passed; fixtures rolled back')
