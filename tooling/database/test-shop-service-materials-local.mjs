import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const sql = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_service_materials.sql', import.meta.url), 'utf8')
const container = process.env.SHOP_MATERIAL_TEST_CONTAINER ?? 'supabase_db_building-suit-shop'
const database = process.env.SHOP_MATERIAL_TEST_DATABASE ?? 'postgres'
if (!['supabase_db_building-suit-shop', 'shop_material_disposable'].includes(container) || (database !== 'postgres' && !database.startsWith('shop_material_test_'))) throw new Error('Disposable local database required')
const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq'], { input: `BEGIN;\n${sql}\nROLLBACK;`, encoding: 'utf8' })
if (result.status !== 0) { console.error(result.stderr || result.error); process.exitCode = 1 }
else console.log('Service material SQL regressions passed; synthetic fixtures rolled back')
