import { legalDocuments } from '~/utils/legal'
import { canIndex, isPublicPath, productionOrigin } from '../../shared/publicSeo'
export function useShopSeo() {
  const route = useRoute()
  const config = useRuntimeConfig()
  const origin = useRequestURL().origin
  const { locale } = useI18n()
  useHead(() => {
    const publicPage = isPublicPath(route.path)
    const canonical = `${productionOrigin}${publicPage ? route.path : '/'}`
    const documentKey = ({ '/about': 'about', '/contact': undefined, '/terms': 'terms', '/privacy': 'privacy', '/delivery-shipping': 'delivery', '/refund-cancellation': 'refund' } as const)[route.path as '/about']
    const document = documentKey ? legalDocuments[documentKey][locale.value === 'ar' ? 'ar' : 'en'] : undefined
    const title = document ? `${document.title} · Shop Suit` : 'Shop Suit · Building Suit'
    const description = document?.intro || (locale.value === 'ar' ? 'Shop Suit من Building Suit لإدارة المتاجر والمبيعات والمخزون والخدمات.' : 'Shop Suit by Building Suit: manage shops, sales, inventory and services.')
    return {
      title,
      link: publicPage ? [{ rel: 'canonical', href: canonical, key: 'canonical' }] : [],
      meta: [
        { name: 'robots', content: canIndex(config.public.appEnvironment, origin) && publicPage ? 'index, follow' : 'noindex, nofollow' },
        { name: 'description', content: description },
        ...(publicPage ? [
          { property: 'og:type', content: 'website' }, { property: 'og:site_name', content: 'Shop Suit' },
          { property: 'og:title', content: title }, { property: 'og:description', content: description },
          { property: 'og:url', content: canonical }, { property: 'og:locale', content: locale.value === 'ar' ? 'ar_EG' : 'en_US' },
          { property: 'og:image', content: `${productionOrigin}/brand/shop-suit-email-mark.png` },
          { property: 'og:image:alt', content: 'Shop Suit logo' },
          { name: 'twitter:card', content: 'summary' }, { name: 'twitter:title', content: title },
          { name: 'twitter:description', content: description },
          { name: 'twitter:image', content: `${productionOrigin}/brand/shop-suit-email-mark.png` },
        ] : []),
        ...(config.public.searchConsoleVerification && canIndex(config.public.appEnvironment, origin) ? [{ name: 'google-site-verification', content: config.public.searchConsoleVerification }] : []),
      ],
      script: route.path === '/' ? [{ key: 'shop-structured-data', type: 'application/ld+json', innerHTML: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Shop Suit',
        url: productionOrigin, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
        description, inLanguage: ['ar', 'en'], publisher: { '@type': 'Organization', name: 'Building Suit' },
        image: `${productionOrigin}/brand/shop-suit-email-mark.png`,
      }) }] : [],
    }
  })
}
