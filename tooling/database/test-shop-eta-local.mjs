import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const sql=await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_eta_submission.sql',import.meta.url),'utf8')
const result=spawnSync('docker',['exec','-i','supabase_db_building-suit-shop','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{input:`BEGIN;\n${sql}\nROLLBACK;`,encoding:'utf8'})
if(result.status!==0){console.error(result.stderr||result.error);process.exitCode=1}
else console.log('ETA configuration, replay, authorization, POS serialization, immutable snapshots, crash safety and state transitions passed; fixtures rolled back')
