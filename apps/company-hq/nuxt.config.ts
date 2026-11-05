import { randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

// Nitro's development worker receives Unix-socket requests without a TCP peer.
// Only the outer development server may attest a checked loopback request.
const hqBrainDevProxyToken = randomBytes(32).toString('hex')
const hqBrainDevProxyHeader = 'x-hq-brain-dev-proxy'
const hqBrainLoopbackPeers = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const attestHqDevelopmentRequest = (event: { node: { req: IncomingMessage } }) => {
  const request = event.node.req
  delete request.headers[hqBrainDevProxyHeader]
  if (!request.socket.remoteAddress || !hqBrainLoopbackPeers.has(request.socket.remoteAddress)) {
    throw Object.assign(new Error('HQ access unavailable'), { statusCode: 403, statusMessage: 'HQ access unavailable' })
  }
  request.headers[hqBrainDevProxyHeader] = hqBrainDevProxyToken
}

export default defineNuxtConfig({
  extends: ['@building-suit/nuxt-layer'],
  compatibilityDate: '2026-11-03',
  devtools: { enabled: false },
  devServer: { host: '127.0.0.1', port: 3101 },
  // Strip caller attestations at the TCP boundary for both private APIs.
  devServerHandlers: ['/api/brain', '/api/hq'].map(route => ({ route, handler: attestHqDevelopmentRequest })),
  runtimeConfig: {
    hqBrainGoogleClientEmail: '', hqBrainGooglePrivateKey: '', hqBrainDevProxyToken,
    hqSupabaseUrl: '', hqSupabasePublishableKey: '', hqEnvironment: 'staging',
    hqFounderEmail: 'ceo@building-suit.com',
    hqAppOrigin: '',
    hqMeetingsDemo: false, hqMeetingsDemoDatabase: '', hqMeetingsLive: false,
  },
  i18n: { locales: [{ code: 'en', language: 'en-US', file: 'en.json' }, { code: 'ar', language: 'ar-EG', dir: 'rtl', file: 'ar.json' }] },
  nitro: { preset: process.env.VERCEL ? 'vercel' : 'node-server', externals: { inline: [/shared\/meetings\//] } },
  app: { head: { title: 'Building Suit HQ' } },
  routeRules: { '/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' } } },
})
