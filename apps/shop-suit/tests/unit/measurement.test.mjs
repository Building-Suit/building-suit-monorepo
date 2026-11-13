import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertMeasurement, measurementUnits } from '../../app/utils/measurement.js'

test('physical conversions remain exact in canonical quantities', () => {
  for (const [quantity, from, to, expected] of [
    ['100', 'cm', 'm', '1'], ['1000', 'mm', 'm', '1'], ['1000', 'g', 'kg', '1'],
    ['250', 'g', 'kg', '0.25'], ['1000', 'ml', 'l', '1'], ['10000', 'cm2', 'm2', '1'],
    ['1', 'ft', 'm', '0.3048'], ['3048', 'mm', 'ft', '10'], ['1', 'pair', 'ea', '2'],
    ['2', 'dozen', 'ea', '24'], ['0.000001', 'kg', 'mg', '1'], ['250', 'cm', 'm', '2.5'],
  ]) assert.equal(convertMeasurement(quantity, from, to), expected)
})
test('conversion rejects incompatible physical dimensions and product-specific packaging', () => {
  for (const [from, to] of [['kg', 'm'], ['l', 'ea'], ['m2', 'm']]) {
    assert.throws(() => convertMeasurement('1', from, to), /INCOMPATIBLE_MEASUREMENT_DIMENSION/)
  }
  for (const code of ['set', 'pack', 'box', 'carton', 'bag', 'roll', 'reel']) {
    assert.throws(() => convertMeasurement('1', code, 'm'), /PRODUCT_PACKAGING_REQUIRED/)
    assert.throws(() => convertMeasurement('1', 'm', code), /PRODUCT_PACKAGING_REQUIRED/)
  }
  assert.throws(() => convertMeasurement('1', 'metre', 'm'), /MEASUREMENT_UNIT_NOT_FOUND/)
})
test('invalid input, source precision and inexact target conversion never round', () => {
  for (const input of [1, null, undefined, '', 'NaN', 'Infinity', '-1', '0', '.1', '1e3', ' 1', '1 ', '1.0000001', '1000000000000']) {
    assert.throws(() => convertMeasurement(input, 'm', 'm'), /INVALID_MEASUREMENT_QUANTITY/)
  }
  assert.throws(() => convertMeasurement('0.5', 'ea', 'ea'), /INVALID_MEASUREMENT_PRECISION/)
  assert.throws(() => convertMeasurement('1', 'ea', 'dozen'), /UNREPRESENTABLE_MEASUREMENT_QUANTITY/)
  assert.throws(() => convertMeasurement('1', 'm', 'ft'), /UNREPRESENTABLE_MEASUREMENT_QUANTITY/)
  assert.throws(() => convertMeasurement('0.000001', 'ft', 'm'), /UNREPRESENTABLE_MEASUREMENT_QUANTITY/)
  assert.throws(() => convertMeasurement('999999999999', 'km', 'm'), /UNREPRESENTABLE_MEASUREMENT_QUANTITY/)
})
test('product increment is checked after conversion into the base unit', () => {
  assert.equal(convertMeasurement('250', 'cm', 'm', '0.01'), '2.5')
  assert.equal(convertMeasurement('12.5', 'm', 'm', '0.001'), '12.5')
  assert.equal(convertMeasurement('250', 'g', 'kg', '0.001'), '0.25')
  assert.equal(convertMeasurement('2', 'ea', 'ea', '1'), '2')
  assert.throws(() => convertMeasurement('1', 'mm', 'm', '0.01'), /INVALID_MEASUREMENT_INCREMENT/)
  for (const invalid of ['0', '-1', '2', 'NaN', '0.0000001']) {
    assert.throws(() => convertMeasurement('1', 'm', 'm', invalid), /INVALID_MEASUREMENT_INCREMENT/)
  }
  assert.throws(() => convertMeasurement('1', 'ea', 'ea', '0.1'), /INVALID_MEASUREMENT_INCREMENT/)
})
test('large quantities and canonical decimal serialization do not lose digits', () => {
  assert.equal(convertMeasurement('999999999999.999999', 'm', 'm'), '999999999999.999999')
  assert.equal(convertMeasurement('000001.500000', 'm', 'm'), '1.5')
  assert.equal(convertMeasurement('0.000001', 'm', 'm'), '0.000001')
})
test('registry snapshots cannot be mutated by a client consumer', () => {
  assert.throws(() => { measurementUnits[0].factor = '100' }, TypeError)
  assert.throws(() => measurementUnits.push({ code: 'custom' }), TypeError)
  assert.ok(measurementUnits.every(unit => unit.nameEn && unit.nameAr && unit.symbol))
})
