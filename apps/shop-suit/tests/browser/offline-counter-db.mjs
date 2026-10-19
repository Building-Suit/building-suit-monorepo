// Fixed disposable container; no hosted URL/ref or arbitrary connection override.
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const sql = await readFile(new URL('../../supabase/tests/shop_offline_counter.sql', import.meta.url), 'utf8')
const result = spawnSync('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: `BEGIN;\n${sql}\nROLLBACK;`, encoding: 'utf8' })
if (result.status !== 0) { console.error(result.stderr || result.error); process.exit(1) }
console.log('PASS: authenticated SQL atomic sale replay; one invoice/payment/stock/drawer effect; changed-envelope rejection; price conflict rollback; completed replay after close; stale drawer rejection. Synthetic fixtures rolled back.')
