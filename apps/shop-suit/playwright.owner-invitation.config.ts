import {defineConfig,devices} from '@playwright/test'
import {fileURLToPath} from 'node:url'
export default defineConfig({
  testDir:'./tests/e2e',testMatch:'owner-invitation.spec.ts',workers:1,retries:0,
  outputDir:'./test-results/owner-invitation',
  use:{...devices['Desktop Chrome'],baseURL:'http://127.0.0.1:4325',screenshot:'only-on-failure'},
  webServer:{command:'node .output/server/index.mjs',cwd:fileURLToPath(new URL('./',import.meta.url)),url:'http://127.0.0.1:4325',reuseExistingServer:false,
    env:{PORT:'4325',HOST:'127.0.0.1',NUXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:61321',NUXT_PUBLIC_SUPABASE_KEY:'local-browser-test-key'}},
})
