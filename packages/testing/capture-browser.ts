import {test as base} from '@playwright/test'
import {createCaptureProtocolObserver} from './capture-protocol.mjs'

export const captureProtocol = createCaptureProtocolObserver()
export const captureProtocolEnabled = process.env.BS_CAPTURE_PROTOCOL_DIAGNOSTIC === 'true'
if (captureProtocolEnabled && process.env.DEBUG) throw new Error('Raw debug logging must be disabled for capture protocol observation')
// The diagnostic uses Playwright's supported server logger so protocol payloads
// never enter stdout, DEBUG logs or artifacts. The server binds owned loopback.
export const test = captureProtocolEnabled ? base.extend({
  browser: [async ({playwright, browserName, headless, channel, launchOptions}, use) => {
    const server = await playwright[browserName].launchServer({...launchOptions, headless, channel, host:'127.0.0.1', logger:captureProtocol.logger})
    try {
      const browser = await playwright[browserName].connect(server.wsEndpoint())
      try { await use(browser) } finally { await browser.close() }
    } finally { await server.close() }
  }, {scope:'worker'}],
}) : base
