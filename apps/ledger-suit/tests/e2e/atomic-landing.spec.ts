import { landingBrowserMatrix } from '../../../../packages/testing/atomic-landing-browser'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
landingBrowserMatrix({ login: '/login', backend: 60321, rpc: 'subscription_plan_catalog', signup: '/signup', yearly: { en: en.billing.yearly, ar: ar.billing.yearly }, initialPrice: /399|٣٩٩/, annualPrice: /3,255|٣٬٢٥٥/, catalog: [{ plan_key: 'solo', name: 'Solo', description: 'Independent workspace', display_order: 1, is_purchasable: true, prices: { monthly: { amount_minor: 39900 }, yearly: { amount_minor: 325584 } }, entitlements: { max_members: { limit_value: 1 }, imports: { is_enabled: true } } }] })
