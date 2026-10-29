import{defineConfig}from'@playwright/test'
import{fileURLToPath}from'node:url'
if(process.env.DOCTOR_OPERATIONS_ACCEPTANCE!=='owned-actual-provider')throw new Error('Owned actual operations fixture required')
export default defineConfig({testDir:fileURLToPath(new URL('.',import.meta.url)),testMatch:'dos-m3-*.spec.ts',workers:1,retries:0,timeout:240000,reporter:'list',preserveOutput:'never',outputDir:fileURLToPath(new URL('../../../../test-results/doctor-m3-browser',import.meta.url)),use:{baseURL:'http://127.0.0.1:4342',browserName:'chromium',trace:'off',screenshot:'off',video:'off'}})
