import qualification from './playwright.qualification.config'
import market from './playwright.market.config'
import usability from '../../packages/testing/playwright.shop-ux.config'
import planUi from './playwright.plan-ui.config'
import subscription from './playwright.subscription.config'
import authOtp from './playwright.auth-otp.config'
import publicLegal from './playwright.public-legal.config'

// The control plane selects a spec through the app-local entry point. Keep
// qualification as the default, selecting market or usability for their specs.
// Workers reload this file without the runner's spec arguments. Persist the
// selection in their inherited environment so their baseURL matches the server.
process.env.SHOP_PLAYWRIGHT_SUITE ??= process.argv.some(argument =>
  /(?:^|[/\\])team\.spec(?:\.ts)?$/.test(argument),
) ? 'team' : process.argv.some(argument =>
  /(?:^|[/\\])super-admin-bridge\.spec(?:\.ts)?$/.test(argument),
) ? 'public-legal' : process.argv.some(argument =>
  /(?:^|[/\\])shared-ui-foundation\.spec(?:\.ts)?$/.test(argument),
) ? 'shared-ui' : process.argv.some(argument =>
  /(?:^|[/\\])public-legal\.spec(?:\.ts)?$/.test(argument),
) ? 'public-legal' : process.argv.some(argument =>
  /(?:^|[/\\])auth-otp\.spec(?:\.ts)?$/.test(argument),
) ? 'auth-otp' : process.argv.some(argument =>
  /(?:^|[/\\])subscription-lifecycle\.spec(?:\.ts)?$/.test(argument),
) ? 'subscription' : process.argv.some(argument =>
  /(?:^|[/\\])plan-owner\.spec(?:\.ts)?$/.test(argument),
) ? 'plan-ui' : process.argv.some(argument =>
  /(?:^|[/\\])market-qualification\.spec(?:\.ts)?$/.test(argument),
) ? 'market' : process.argv.some(argument =>
    /(?:^|[/\\])(?:cross-workflow|pilot)-usability\.spec(?:\.ts)?$/.test(argument),
  ) ? 'usability' : 'qualification'

export default process.env.SHOP_PLAYWRIGHT_SUITE === 'team'
  ? import('./playwright.team.config').then(module => module.default)
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'market'
  ? market
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'shared-ui'
    ? import('./playwright.shared-ui.config').then(module => module.default)
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'public-legal' ? publicLegal
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'auth-otp' ? authOtp
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'subscription' ? subscription
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'plan-ui' ? planUi
  : process.env.SHOP_PLAYWRIGHT_SUITE === 'usability' ? usability : qualification
