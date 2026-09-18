export default defineNuxtPlugin(nuxtApp => {
  const { restore } = useTheme()
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const sync = () => restore()
  nuxtApp.hook('app:mounted', sync)
  window.addEventListener('storage', sync)
  media.addEventListener('change', sync)
  nuxtApp.vueApp.onUnmount( () => { window.removeEventListener('storage', sync); media.removeEventListener('change', sync) })
})
