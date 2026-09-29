import qualification from './playwright.qualification.config'
import usability from '../../packages/testing/playwright.shop-ux.config'

// The control plane selects a spec through the app-local entry point. Keep
// qualification as the default, but use the synthetic server for usability specs.
// Workers reload this file without the runner's spec arguments. Persist the
// selection in their inherited environment so their baseURL matches the server.
process.env.SHOP_PLAYWRIGHT_SUITE ??= process.argv.some(argument =>
  /(?:^|[/\\])(?:cross-workflow|pilot)-usability\.spec(?:\.ts)?$/.test(argument),
) ? 'usability' : 'qualification'

export default process.env.SHOP_PLAYWRIGHT_SUITE === 'usability' ? usability : qualification
