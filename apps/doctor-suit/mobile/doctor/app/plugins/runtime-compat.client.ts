// This eager plugin import runs before Nuxt initializes routing/i18n and shared
// controls. A syntax target alone cannot supply their newer standard APIs on
// the stock WebView in the mandatory API29 matrix.
import 'core-js/actual/index.js'

export default defineNuxtPlugin({name:'doctor-runtime-compat',enforce:'pre',setup(){}})
