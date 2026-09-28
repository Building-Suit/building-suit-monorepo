<script setup lang="ts">
import type { SupportRpcDatabase } from '../../types/support-rpc.types'
import { publicBusiness } from '~/utils/legal'

definePageMeta({ layout: 'marketing' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<SupportRpcDatabase>()
const form = reactive({ category: 'general', subject: '', message: '', email: '', consent: false, honeypot: '' })
const pending = ref(false)
const sent = ref(false)
const error = ref('')
const user = useSupabaseUser()
watch(user, value => { if (value?.email && !form.email) form.email = value.email })
async function submit() {
  error.value = ''; sent.value = false
  if (!form.subject.trim() || !form.message.trim() || !form.email.trim() || !form.consent) { error.value = t('marketing.contactValidation'); return }
  pending.value = true
  const { error: failure } = await supabase.rpc('submit_support_request', {
    p_category: form.category, p_subject: form.subject, p_message: form.message,
    p_reply_email: form.email, p_consent: form.consent, p_honeypot: form.honeypot,
  })
  pending.value = false
  if (failure) { error.value = failure.message.includes('RATE_LIMITED') ? t('marketing.contactRateLimited') : t('marketing.contactError'); return }
  sent.value = true; form.subject = ''; form.message = ''; form.consent = false
}

useHead(() => ({
  title: `${t('marketing.contact')} · Ledger Suit`,
  meta: [
    {
      name: 'description',
      content: t('marketing.contactMetaDescription'),
    },
  ],
}))
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-10 lg:px-8 lg:py-14">
    <section class="ls-card overflow-hidden">
        <div class="border-b border-[var(--bs-border)] bg-surface-muted px-6 py-8 sm:px-10">
          <p class="text-xs font-bold uppercase tracking-[.18em] text-brand-gold-highlight">
            Ledger Suit by Building Suit
          </p>
          <h1 class="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">
            {{ t('marketing.contact') }}
          </h1>
          <p class="mt-4 max-w-3xl text-sm leading-7 text-fg-muted sm:text-base">
            {{ t('marketing.contactIntro') }}
          </p>
        </div>

        <div class="grid gap-px bg-[var(--bs-border)] md:grid-cols-3">
          <div class="bg-surface p-6 sm:p-8">
            <p class="text-xs font-bold uppercase tracking-[.14em] text-fg-muted">
              {{ t('marketing.email') }}
            </p>
            <a :href="`mailto:${publicBusiness.supportEmail}`" class="mt-3 block break-all font-bold text-link" dir="ltr">
              {{ publicBusiness.supportEmail }}
            </a>
          </div>

          <div class="bg-surface p-6 sm:p-8">
            <p class="text-xs font-bold uppercase tracking-[.14em] text-fg-muted">
              {{ t('marketing.phone') }}
            </p>
            <a :href="`tel:${publicBusiness.phone}`" class="mt-3 block font-bold text-link" dir="ltr">
              {{ publicBusiness.phone }}
            </a>
          </div>

          <div class="bg-surface p-6 sm:p-8">
            <p class="text-xs font-bold uppercase tracking-[.14em] text-fg-muted">
              {{ t('marketing.businessAddress') }}
            </p>
            <p class="mt-3 font-bold">
              {{ locale === 'ar' ? publicBusiness.addressAr : publicBusiness.addressEn }}
            </p>
          </div>
        </div>

        <form class="grid gap-4 px-6 py-8 sm:px-10" @submit.prevent="submit" novalidate>
          <h2 class="text-xl font-black">{{ t('marketing.contactFormTitle') }}</h2>
          <p class="text-sm text-fg-muted">{{ t('marketing.contactFormIntro') }}</p>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="grid gap-2"><span>{{ t('marketing.contactCategory') }}</span><select v-model="form.category" class="ls-input"><option value="general">{{ t('marketing.contactCategories.general') }}</option><option value="product">{{ t('marketing.contactCategories.product') }}</option><option value="billing">{{ t('marketing.contactCategories.billing') }}</option><option value="technical">{{ t('marketing.contactCategories.technical') }}</option><option value="account">{{ t('marketing.contactCategories.account') }}</option></select></label>
            <label class="grid gap-2"><span>{{ t('marketing.contactReplyEmail') }}</span><input v-model="form.email" class="ls-input" type="email" required autocomplete="email"></label>
          </div>
          <label class="grid gap-2"><span>{{ t('marketing.contactSubject') }}</span><input v-model="form.subject" class="ls-input" maxlength="200" required></label>
          <label class="grid gap-2"><span>{{ t('marketing.contactMessage') }}</span><textarea v-model="form.message" class="ls-input min-h-36" maxlength="10000" required></textarea></label>
          <label class="hidden" aria-hidden="true"><span>Website</span><input v-model="form.honeypot" tabindex="-1" autocomplete="off"></label>
          <label class="flex items-start gap-2"><input v-model="form.consent" type="checkbox" required><span class="text-sm">{{ t('marketing.contactConsent') }}</span></label>
          <p v-if="error" role="alert" class="ls-error">{{ error }}</p><p v-if="sent" role="status" class="text-sm text-success">{{ t('marketing.contactSuccess') }}</p>
          <button class="ls-btn w-fit" type="submit" :disabled="pending">{{ pending ? t('app.loading') : t('marketing.contactSubmit') }}</button>
        </form>
        <div class="px-6 pb-8 sm:px-10">
          <h2 class="text-xl font-black">{{ t('marketing.businessIdentity') }}</h2>
          <p class="mt-3 text-sm leading-7 text-fg-muted sm:text-base">
            <i18n-t keypath="marketing.businessIdentityBody" tag="span" scope="global">
              <template #product><bdi dir="ltr">Ledger Suit</bdi></template>
              <template #parent><bdi dir="ltr">Building Suit</bdi></template>
            </i18n-t>
          </p>
        </div>
    </section>
  </main>
</template>
