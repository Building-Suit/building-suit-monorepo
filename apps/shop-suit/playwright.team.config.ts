import { defineConfig } from '@playwright/test'
import pilot from '../../packages/testing/playwright.shop-pilot.config'

export default defineConfig(pilot, { testMatch: 'team.spec.ts', outputDir: '../../test-results/shop-team' })
