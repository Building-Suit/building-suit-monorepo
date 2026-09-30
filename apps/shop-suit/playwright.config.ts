import qualification from './playwright.qualification.config'
import market from './playwright.market.config'
import usability from '../../packages/testing/playwright.shop-ux.config'
import planUi from './playwright.plan-ui.config'
import subscription from './playwright.subscription.config'

// The control plane selects a spec through the app-local entry point. Keep
// qualification as the default, selecting market or usability for their specs.
// Workers reload this file without the runner's spec arguments. Persist the
// selection in their inherited environment so their baseURL matches the server.
process.env.SHOP_PLAYWRIGHT_SUITE ??= process.argv.some(argument =>
  /(?:^|[/\\])subscription-lifecycle\.spec(?:\.ts)?$/.test(argument),
) ? 'subscription' : process.argv.some(argument =>
  /(?:^|[/\\])plan-owner\.spec(?:\.ts)?$/.test(argument),
) ? 'plan-ui' : process.argv.some(argument =>
  /(?:^|[/\\])market-qualification\.spec(?:\.ts)?$/.test(argument),
) ? 'market' : process.argv.some(argument =>
    /(?:^|[/\\])(?:cross-workflow|pilot)-usability\.spec(?:\.ts)?$/.test(argument),
  ) ? 'usability' : 'qualification'

export default process.env.SHOP_PLAYWRIGHT_SUITE === 'market'
  ? market
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'subscription' ? subscription
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'plan-ui' ? planUi
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'usability' ? usability : qualification
