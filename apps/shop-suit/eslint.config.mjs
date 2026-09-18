import withNuxt from './.nuxt/eslint.config.mjs'
export default withNuxt({ ignores: ['docs/**', 'PATCHES/**', 'supabase/**', 'types/database.types.ts', 'reference/**'] })
