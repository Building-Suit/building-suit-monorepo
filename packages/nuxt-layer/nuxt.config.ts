import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
export default defineNuxtConfig({
  compatibilityDate: '2026-08-30',
  modules: ['@nuxtjs/i18n', '@nuxt/eslint', '@primevue/nuxt-module'],
  nitro: { publicAssets: [{ dir: here('../brand/assets'), baseURL: '/brand' }] },
  css: [here('../ui/src/styles/base.css')],
  vite: { plugins: [tailwindcss()] },
  components: [{ path: here('../ui/src'), pathPrefix: false }],
  imports: { dirs: [here('../ux/src/composables'), here('../auth/src/composables'), here('../data-access/src/composables')] },
  primevue: { options: { unstyled: true }, components: { include: ['InputText','InputNumber','Textarea','Select','MultiSelect','DatePicker','Checkbox','RadioButton','ToggleSwitch','FloatLabel','Dialog','Drawer','Popover','Menu','DataTable','Column','Paginator','FileUpload','Toast','ConfirmDialog','ProgressBar','Tag','Badge','Button','Tree','Accordion','ColumnGroup','Row'] } },
  i18n: { strategy: 'no_prefix', defaultLocale: 'en', detectBrowserLanguage: { useCookie: true, cookieKey: 'building-suit-locale', fallbackLocale: 'en' } },
  typescript: { strict: true },
  app: { head: { script: [{ innerHTML: "try{var t=localStorage.getItem('building-suit.theme')||localStorage.getItem('ledger-suit.theme')||localStorage.getItem('bs-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}else{document.documentElement.removeAttribute('data-theme')}}catch(e){}", tagPosition: 'head' }] } },
})
