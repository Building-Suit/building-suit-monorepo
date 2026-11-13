import assert from 'node:assert/strict'
import test from 'node:test'
import { directProductCreation, directProductCorrection, validateIntent } from './departmentWorkflow.mjs'
const context = { businessMode: 'mixed', productsEnabled: true, businessCurrency: 'EGP' }
for (const [message, name, salePrice] of [
  ['سجل منتج اسمه "شنطة اطفال" بـ 500 جنيه', 'شنطة اطفال', 500],
  ['سجل منتج اسمه "شنطة اطفال" بـ ٥٠٠ جنيه', 'شنطة اطفال', 500],
  ['سجل منتج اسمه "شنطة اطفال" بـ ۵۰۰ جنيه', 'شنطة اطفال', 500],
  ['سجل منتج اسمه شنطة اطفال بسعر ٥٠٠٫٢٥ جنيه مصري', 'شنطة اطفال', 500.25],
  ['سجل منتج اسمه "شنطة اطفال" ب500 جنيه', 'شنطة اطفال', 500],
  ['add product named "Kids bag" for 500 EGP', 'Kids bag', 500],
  ['add product Kids bag at 500', 'Kids bag', 500],
  ['add product Kids bag price: 500.25 EGP', 'Kids bag', 500.25],
  ['add product "Price 500"', 'Price 500', null],
  ['add product "Kids bag"', 'Kids bag', null],
  ['سجل منتج اسمه شنطة اطفال', 'شنطة اطفال', null],
  ['add product "Kids bag" for 0 EGP', 'Kids bag', 0],
]) test(`explicit product details: ${message}`, () => {
  const result = validateIntent(directProductCreation(message, context))
  assert.equal(result.kind, 'create_product')
  assert.deepEqual(result.product, { name, salePrice })
})
for (const suffix of ['for -500 EGP', 'for 500.001 EGP', 'for 500 USD', 'for 5,000 EGP', 'for 500 and 600 EGP', 'for five hundred EGP', 'for 1000000000 EGP']) {
  test(`does not create product for unsupported price ${suffix}`, () => {
    assert.equal(directProductCreation(`add product "Kids bag" ${suffix}`, context).kind, 'reply')
  })
}
test('requires shop context and honors services-only settings', () => {
  assert.equal(directProductCreation('add product Bag', undefined), undefined)
  assert.equal(directProductCreation('add product Bag', { ...context, productsEnabled: false }).kind, 'reply')
})
test('asks only for missing product name', () => {
  assert.equal(directProductCreation('add product', context).missingRequiredField, 'product_name')
})
test('correction never becomes another write or claims an edit', () => {
  for (const message of ['لا اسم المنتج "شنطة اطفال" وسعر المنتج 500 جنيه', 'No, the product name is Kids bag and price is 500']) {
    const result = validateIntent(directProductCorrection(message))
    assert.equal(result.kind, 'reply')
    assert.deepEqual(result.links, [])
    assert.match(result.reply, /الرد السابق|earlier reply/u)
    assert.match(result.reply, /لم أغيّر|have not changed/u)
  }
})
