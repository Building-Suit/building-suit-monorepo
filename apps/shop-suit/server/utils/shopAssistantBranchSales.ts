import { getAssistantOperatingReport } from './shopAssistantActions'
import type { ShopAssistantScope } from './shopAssistantScope'

const arabicDailySales = [
  /^(?:اجمالي )?مبيعات (?:الفرع|الفرع الحالي|الفرع ده) (?:النهارده|النهاردة|اليوم)(?: (?:كام|كم))?$/u,
  /^(?:كام|كم|كم بلغت) (?:اجمالي )?مبيعات (?:الفرع|الفرع الحالي|الفرع ده) (?:النهارده|النهاردة|اليوم)$/u,
]
const englishDailySales = [
  /^(?:show me |what (?:are|were) )?(?:the )?(?:total )?sales (?:at|for|in) (?:the |this |our |my |the selected |the current )?branch today$/u,
  /^(?:show me |what (?:are|were) )?(?:the )?(?:total )?branch sales today$/u,
  /^(?:show me |what (?:are|were) )?today's (?:total )?branch sales$/u,
  /^how much (?:are|were) (?:the )?(?:total )?(?:branch sales|sales (?:at|for|in) (?:the |this |our |my |the selected |the current )?branch) today$/u,
]

export async function tryShopAssistantBranchSales(
  scope: ShopAssistantScope,
  messages: readonly { role: 'user' | 'assistant'; content: string }[],
) {
  const latest = messages.at(-1)
  if (latest?.role !== 'user') return null
  const question = latest.content.normalize('NFKC')
    .replace(/\u0640|[\u064B-\u065F]|\u0670/gu, '')
    .replace(/[أإآ]/gu, 'ا')
    .replace(/’/gu, "'")
    .trim().replace(/[?؟!.]+$/u, '').trim().replace(/\s+/gu, ' ').toLowerCase()
  const isArabic = arabicDailySales.some(pattern => pattern.test(question))
  if (!isArabic && !englishDailySales.some(pattern => pattern.test(question))) return null

  const report = await getAssistantOperatingReport(scope, 'day')
  const locale = isArabic ? 'ar-EG' : 'en-EG'
  const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: report.currency }).format(report.sales)
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(report.fromDate + 'T00:00:00Z'))

  const text = isArabic
    ? `إجمالي مبيعات فرع «${report.location}» النهارده (${date}) ${amount}.`
    : `Sales at “${report.location}” today (${date}) totaled ${amount}.`

  return { text, link: { destination: 'reports' as const } }
}
