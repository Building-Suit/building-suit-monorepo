import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { encodeCsv, importTemplates, parseCsv, validateImportHeaders } from '../../app/utils/catalogImport.js'

test('parses UTF-8 BOM, Excel CSV quoting, Arabic and embedded newlines', () => {
  const rows = parseCsv('\uFEFFname,sku,notes\r\n"قهوة, كبيرة",A-1,"سطر 1\r\nسطر 2"\r\n')
  assert.deepEqual(rows, [{ row_number: 2, name: 'قهوة, كبيرة', sku: 'A-1', notes: 'سطر 1\r\nسطر 2' }])
})

test('rejects malformed and unbounded input', () => {
  assert.throws(() => parseCsv('name,name\na,b\n'), /INVALID_HEADERS/)
  assert.throws(() => parseCsv('name\n"broken'), /UNCLOSED_QUOTE/)
  assert.throws(() => parseCsv('name\na\nb\n', { maxRows: 1 }), /TOO_MANY_ROWS/)
  assert.throws(() => parseCsv('name\nabc', { maxBytes: 4 }), /FILE_TOO_LARGE/)
})

test('templates expose required product fields and exports neutralize formulas', () => {
  assert.deepEqual(validateImportHeaders('products', [{ name: 'A' }]), ['sale_price'])
  const csv = encodeCsv(importTemplates.products, [{ name: '=cmd', sale_price: 10 }])
  assert.match(csv, /^\uFEFFname,sku,barcode,sale_price/)
  assert.match(csv, /'=cmd/)
})

test('database contract keeps imports bounded, atomic, idempotent and on FIFO stock commands', async () => {
  const migration = await readFile(new URL('../../supabase/migrations/20260929120000_catalog_categories_import_barcode.sql', import.meta.url), 'utf8')
  assert.match(migration, /jsonb_array_length\(p_rows\) > 1000/)
  assert.match(migration, /catalog_import_requests/)
  assert.match(migration, /shop_private\.adjust_stock\(/)
  assert.match(migration, /products_category_shop_fk/)
  assert.match(migration, /products_shop_active_barcode_unique/)
  assert.doesNotMatch(migration, /update public\.inventory_batches set remaining_quantity = remaining_quantity \+/)
})
