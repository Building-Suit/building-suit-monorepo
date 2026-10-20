import {defineConfig} from '@playwright/test'
import {fileURLToPath} from 'node:url'
if(process.env.DOCTOR_CLINICAL_ACCEPTANCE!=='owned-actual-provider')throw new Error('Owned actual clinical fixture required')
export default defineConfig({testDir:fileURLToPath(new URL('.',import.meta.url)),testMatch:'dos-m2-*.spec.ts',workers:1,retries:0,timeout:120000,outputDir:fileURLToPath(new URL('../../../../test-results/doctor-m2-browser',import.meta.url)),preserveOutput:'never',reporter:'list',use:{baseURL:'http://127.0.0.1:4341',browserName:'chromium',trace:'off',screenshot:'off',video:'off'}})
