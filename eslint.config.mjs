import withNuxt from './apps/building-suit-docs/.nuxt/eslint.config.mjs'
export default withNuxt({ ignores: ['apps/**', '**/generated/**', '**/assets/**', 'supabase/**', 'docs/**'] })
