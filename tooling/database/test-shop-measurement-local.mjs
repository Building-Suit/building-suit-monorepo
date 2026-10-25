import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { measurementUnits } from '../../apps/shop-suit/app/utils/measurement.js'

// Deliberately fixed local container. No connection URL, environment ref, hosted
// database or arbitrary container override is accepted by this runner.
const command = sql => spawnSync('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], { input: sql, encoding: 'utf8', timeout: 120000 })
for (const suite of ['shop_measurement_foundation','shop_measured_retail','shop_electrical_reels','shop_trade_pricing','shop_trade_quotations','shop_trade_orders','shop_order_reservations','shop_order_funding','shop_order_fulfillment','shop_supplier_orders','shop_supply_planning']) {
  const result = command(`BEGIN;\n${readFileSync(new URL(`../../apps/shop-suit/supabase/tests/${suite}.sql`, import.meta.url), 'utf8')}\nROLLBACK;`)
  if (result.status !== 0) {
    console.error(`${suite}: FAILED\n${result.stderr || result.error}`)
    process.exit(1)
  }
  console.log(`${suite}: PASS; real local Supabase SQL, fixture rolled back`)
}
// Actual migrated DB/preview conformance, rather than checking source tokens.
const registry = command("select jsonb_agg(jsonb_build_object('code',code,'factor',case when canonical_conversion_factor is null then null else trim_scale(canonical_conversion_factor)::text end,'precision',allowed_precision,'nameEn',name_en,'nameAr',name_ar,'symbol',symbol,'dimension',dimension,'isActive',is_active) order by code) from public.units_of_measure;")
assert.equal(registry.status, 0, 'Migrated unit registry must be readable')
assert.deepEqual(JSON.parse(registry.stdout.trim()), measurementUnits.map(unit => ({ code: unit.code, factor: unit.factor, precision: unit.allowedPrecision, nameEn: unit.nameEn, nameAr: unit.nameAr, symbol: unit.symbol, dimension: unit.dimension, isActive: unit.isActive })).sort((a, b) => a.code.localeCompare(b.code, 'en')))
console.log('shop_measurement_foundation: PASS; real SQL conversions, configuration, compatibility, grants/RLS, tenant/subscription denial, prepared stock guards and registry conformance; fixtures rolled back')
