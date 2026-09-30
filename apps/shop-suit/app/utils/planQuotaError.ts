import type { PlanResourceKey } from '~/types/plans'

const legacyResources: Record<string, PlanResourceKey> = {
  PRODUCT_LIMIT_REACHED: 'active_products',
  SERVICE_LIMIT_REACHED: 'active_services',
}

export function planQuotaResource(error: unknown): PlanResourceKey | null {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : String(error ?? '')
  for (const [code, resource] of Object.entries(legacyResources)) {
    if (message.includes(code)) return resource
  }
  const match = message.match(/PLAN_RESOURCE_LIMIT_REACHED:(active_locations|active_members|active_products|active_services)(?::|\b)/)
  return (match?.[1] as PlanResourceKey | undefined) ?? null
}

export function planQuotaMessage(error: unknown, locale: string) {
  const resource = planQuotaResource(error)
  if (!resource) return null
  const arabic = locale === 'ar'
  const labels: Record<PlanResourceKey, [string, string]> = {
    active_locations: ['active location', 'الفروع النشطة'],
    active_members: ['team member', 'أعضاء الفريق'],
    active_products: ['active product', 'المنتجات النشطة'],
    active_services: ['active service', 'الخدمات النشطة'],
  }
  return arabic
    ? `وصلت إلى حد ${labels[resource][1]} في خطتك. أرشف أو أوقف عنصرًا غير مستخدم، أو اطلب خطة أعلى من صفحة الاشتراك والفوترة. لن يحذف النظام بياناتك تلقائيًا.`
    : `Your plan's ${labels[resource][0]} limit is full. Archive or deactivate something unused, or request a higher plan from Subscription & billing. Nothing will be deleted automatically.`
}
