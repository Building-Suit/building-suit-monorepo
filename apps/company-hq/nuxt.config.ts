import { randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

// Nitro's development worker receives Unix-socket requests without a TCP peer.
// Only the outer development server may attest a checked loopback request.
const hqBrainDevProxyToken = randomBytes(32).toString('hex')
const hqBrainDevProxyHeader = 'x-hq-brain-dev-proxy'
const hqBrainLoopbackPeers = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  compatibilityDate: '2026-11-03',
  devtools: { enabled: false },
  devServer: { host: '127.0.0.1', port: 3101 },
  devServerHandlers: [{
    route: '/api/brain',
    handler: (event: { node: { req: IncomingMessage } }) => {
      const request = event.node.req
      // Never forward a caller's attestation, including duplicate header values.
      delete request.headers[hqBrainDevProxyHeader]
      if (!request.socket.remoteAddress || !hqBrainLoopbackPeers.has(request.socket.remoteAddress)) {
        throw Object.assign(new Error('Brain access unavailable'), { statusCode: 403, statusMessage: 'Brain access unavailable' })
      }
      request.headers[hqBrainDevProxyHeader] = hqBrainDevProxyToken
    },
  }],
  runtimeConfig: { hqBrainGoogleClientEmail: '', hqBrainGooglePrivateKey: '', hqBrainDevProxyToken },
  i18n: { locales: [{ code: 'en', language: 'en-US', file: 'en.json' }, { code: 'ar', language: 'ar-EG', dir: 'rtl', file: 'ar.json' }] },
  nitro: { preset: 'node-server' },
  app: { head: { title: 'Building Suit HQ' } },
  routeRules: { '/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } } },
})
