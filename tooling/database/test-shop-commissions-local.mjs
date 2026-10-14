import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const sql = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_commissions.sql', import.meta.url), 'utf8')
const container = process.env.SHOP_COMMISSION_TEST_CONTAINER ?? 'supabase_db_building-suit-shop'
if (!['supabase_db_building-suit-shop', 'shop_commission_disposable'].includes(container)) throw new Error('Disposable local Shop container required')
const database = process.env.SHOP_COMMISSION_TEST_DATABASE ?? 'postgres'
if (database !== 'postgres' && !database.startsWith('shop_commission_test_')) throw new Error('Disposable fixture database required')
const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'], { input: `BEGIN;\n${sql}\nROLLBACK;`, encoding: 'utf8' })
if (result.status !== 0) { console.error(result.stderr || result.error); process.exitCode = 1 }
else console.log('Commission SQL regressions passed; all synthetic fixtures rolled back')
