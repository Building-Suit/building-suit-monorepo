import {defineConfig} from '@playwright/test'
import atomicShop from '../../../../packages/testing/playwright.atomic-shop.config'
const servers=atomicShop.webServer
if(!Array.isArray(servers))throw Error('Maintained Shop fixture required')
export default defineConfig({...atomicShop,testMatch:'website-hostname-owner.spec.ts',outputDir:'../../../../test-results/website-hostname-owner',webServer:servers.map(server=>({...server,env:{...server.env,NUXT_PUBLIC_APP_ENVIRONMENT:'staging',NUXT_PUBLIC_WEBSITE_HOSTNAME_SUFFIX:'stg.shops.building-suit.com'}}))})
