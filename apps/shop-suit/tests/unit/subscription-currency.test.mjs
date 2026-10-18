import test from 'node:test'
import assert from 'node:assert/strict'
import { subscriptionCurrencyChoice } from '../../app/utils/subscription-currency.mjs'
import { xpayMoneyTracks } from '../../supabase/functions/_shared/xpay-money.mjs'
import { verifyMerchantReadiness, validateSession, checkoutBody } from '../../supabase/functions/_shared/xpay.mjs'

const account = { id: 'merchant-fixture', livemode: false, livePaymentsEnabled: false,
  supportedCurrencies: [{ code: 'EGP', decimals: 2, paymentMethodTypes: ['card'] }, { code: 'USD', decimals: 2, paymentMethodTypes: ['card'] }],
  apiKey: { mode: 'test', type: 'SECRET', permissions: ['CHECKOUT_SESSIONS_READ', 'CHECKOUT_SESSIONS_WRITE'] } }
const settings = { secretKey: 'sk_test_fixture', mode: 'test', merchantId: account.id }
const provider = value => async url => { assert.equal(url, 'https://api.xpay.app/account'); return Response.json(value) }
const session = { id: 'cs_test_fixture', object: 'checkout.session', merchantId: account.id, livemode: false,
  metadata: { orderId: 'order-fixture' }, currency: 'EGP', amountTotal: 34900, status: 'complete', paymentStatus: 'paid', paymentIntentId: 'pi_test_fixture' }
const order = { id: 'order-fixture', merchantId: account.id, currency: 'EGP', amountMinor: 34900 }
const usd = { currency: 'USD', amountTotal: 699, exchangeRate: 49.92846924177396, exchangeRateId: 'fx_fixture' }

test('Egypt/unknown country defaults to EGP; foreign country is a suggestion and explicit selection wins', () => {
  for (const countryHint of [null, '', 'EG', 'eg', 'Egypt', '<US>', 42]) assert.equal(subscriptionCurrencyChoice({ countryHint }).currency, 'EGP')
  assert.deepEqual(subscriptionCurrencyChoice({ countryHint: 'US', selectedCurrency: 'EGP' }), {
    currency: 'EGP', requestedCurrency: 'EGP', suggestedCurrency: 'USD', source: 'explicit', requiresCurrencyChange: false,
  })
  assert.equal(subscriptionCurrencyChoice({ countryHint: 'FR' }).source, 'suggestion')
  assert.equal(subscriptionCurrencyChoice({ countryHint: 'EG', selectedCurrency: 'USD' }).requestedCurrency, 'USD')
  for (const selectedCurrency of ['EUR', 'usd', '', 1]) assert.throws(() => subscriptionCurrencyChoice({ selectedCurrency }))
})
test('country hints cannot change an existing commercial currency; explicit changes require a separate quote', () => {
  assert.equal(subscriptionCurrencyChoice({ countryHint: 'US', committedCurrency: 'EGP' }).currency, 'EGP')
  assert.deepEqual(subscriptionCurrencyChoice({ selectedCurrency: 'USD', committedCurrency: 'EGP' }), {
    currency: 'EGP', requestedCurrency: 'USD', suggestedCurrency: 'EGP', source: 'explicit', requiresCurrencyChange: true,
  })
  assert.equal(subscriptionCurrencyChoice({ committedCurrency: 'USD', countryHint: 'EG' }).currency, 'USD')
  assert.throws(() => subscriptionCurrencyChoice({ committedCurrency: 'GBP' }))
})
test('merchant readiness checks the requested charge currency and its methods, never foreign-card acceptance alone', async () => {
  assert.deepEqual(await verifyMerchantReadiness({ ...settings, chargeCurrency: 'USD', fetchImpl: provider(account) }), { ready: true, mode: 'test' })
  const egpOnly = { ...account, supportedCurrencies: account.supportedCurrencies.slice(0, 1) }
  await verifyMerchantReadiness({ ...settings, fetchImpl: provider(egpOnly) })
  await assert.rejects(verifyMerchantReadiness({ ...settings, chargeCurrency: 'USD', fetchImpl: provider(egpOnly) }))
  const usdOnly = { ...account, supportedCurrencies: account.supportedCurrencies.slice(1) }
  await assert.rejects(verifyMerchantReadiness({ ...settings, fetchImpl: provider(usdOnly) }))
  for (const currency of [{ code: 'USD', decimals: 3, paymentMethodTypes: ['card'] }, { code: 'USD', decimals: 2, paymentMethodTypes: ['fawry'] }]) {
    await assert.rejects(verifyMerchantReadiness({ ...settings, chargeCurrency: 'USD', fetchImpl: provider({ ...account, supportedCurrencies: [currency] }) }))
  }
  await assert.rejects(verifyMerchantReadiness({ ...settings, chargeCurrency: 'EUR', fetchImpl: async () => assert.fail('unsupported currency must not contact provider') }))
})
test('USD eligibility does not waive live activation, mode, account or restricted-key permissions', async () => {
  const live = { ...account, livemode: true, apiKey: { ...account.apiKey, mode: 'live' } }
  for (const patch of [live, { ...account, id: 'foreign-merchant' }, { ...account, apiKey: { ...account.apiKey, permissions: ['CHECKOUT_SESSIONS_READ'] } }]) {
    await assert.rejects(verifyMerchantReadiness({ ...settings, chargeCurrency: 'USD', fetchImpl: provider(patch) }))
  }
  await assert.rejects(verifyMerchantReadiness({ ...settings, secretKey: 'sk_live_fixture', mode: 'live', chargeCurrency: 'USD', fetchImpl: provider(live) }))
})
test('processing EGP and presentment USD stay separate; no locally recomputed FX amount', () => {
  const tracks = xpayMoneyTracks({ ...session, presentmentDetails: usd })
  assert.deepEqual(tracks, { processing: { currency: 'EGP', amountMinor: 34900 }, presentment: { currency: 'USD', amountMinor: 699 }, exchangeRate: { id: usd.exchangeRateId, rate: usd.exchangeRate } })
  assert.deepEqual(xpayMoneyTracks(session), { processing: { currency: 'EGP', amountMinor: 34900 }, presentment: { currency: 'EGP', amountMinor: 34900 }, exchangeRate: null })
  assert.deepEqual(xpayMoneyTracks({ ...session, presentmentDetails: { currency: 'EGP', amountTotal: 34900 } }), xpayMoneyTracks(session))
  for (const patch of [{ currency: 'EUR' }, { amountTotal: 0 }, { amountTotal: 6.99 }, { exchangeRate: null }, { exchangeRate: Infinity }, { exchangeRateId: '' }]) {
    assert.throws(() => xpayMoneyTracks({ ...session, presentmentDetails: { ...usd, ...patch } }))
  }
  assert.throws(() => xpayMoneyTracks({ ...session, currency: 'USD' }))
  assert.throws(() => xpayMoneyTracks({ ...session, presentmentDetails: { currency: 'EGP', amountTotal: 1 } }))
})
test('existing EGP fulfillment rejects a foreign mirror even when processing amount matches; USD binds its own presentment amount without comparing it to EGP processing', () => {
  validateSession(session, order, 'test', { paid: true })
  assert.throws(() => validateSession({ ...session, presentmentDetails: usd }, order, 'test', { paid: true }), /xpay_session_mismatch/)
  const usdOrder = { ...order, currency: 'USD', amountMinor: 699 }
  validateSession({ ...session, presentmentDetails: usd }, usdOrder, 'test', { paid: true })
  assert.throws(() => validateSession(session, usdOrder, 'test', { paid: true }))
  const body = checkoutBody({ ...usdOrder, description: 'Solo' }, { returnUrl: 'https://shop.example/billing', cancelUrl: 'https://shop.example/billing' })
  assert.equal(body.currency, 'USD')
  assert.equal(body.lineItems[0].priceData.unitAmount, 699)
  assert.deepEqual(body.paymentMethodTypes, ['card'])
})

test('the bound USD session locks processing amount and FX evidence across retrievals', () => {
  const paid = { ...session, presentmentDetails: usd }
  const bound = { ...order, currency: 'USD', amountMinor: 699, moneyTracks: xpayMoneyTracks(paid) }
  validateSession(paid, bound, 'test', { paid: true })
  for (const change of [{ amountTotal: 34901 }, { presentmentDetails: { ...usd, exchangeRateId: 'different' } }, { presentmentDetails: { ...usd, exchangeRate: 1 } }]) assert.throws(() => validateSession({ ...paid, ...change }, bound, 'test', { paid: true }))
})
