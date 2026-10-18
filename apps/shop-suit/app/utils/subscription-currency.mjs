const currencies = new Set(['EGP', 'USD'])
// This is a presentation preference, never a quote, price, or eligibility check.
export function subscriptionCurrencyChoice({ selectedCurrency = null, countryHint = null, committedCurrency = null } = {}) {
  if (selectedCurrency !== null && !currencies.has(selectedCurrency)) throw new Error('subscription_currency_invalid')
  if (committedCurrency !== null && !currencies.has(committedCurrency)) throw new Error('subscription_currency_invalid')
  const country = typeof countryHint === 'string' && /^[A-Za-z]{2}$/.test(countryHint) ? countryHint.toUpperCase() : null
  const suggestedCurrency = country && country !== 'EG' ? 'USD' : 'EGP'
  const requestedCurrency = selectedCurrency ?? committedCurrency ?? suggestedCurrency
  return { currency: committedCurrency ?? requestedCurrency, requestedCurrency, suggestedCurrency,
    source: selectedCurrency ? 'explicit' : committedCurrency ? 'subscription' : 'suggestion',
    requiresCurrencyChange: committedCurrency !== null && requestedCurrency !== committedCurrency }
}
