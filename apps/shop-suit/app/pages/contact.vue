<script setup lang="ts">
import type { SupportRpcDatabase } from '~/types/supportRpc'
import { publicBusiness } from '~/utils/legal'

definePageMeta({ layout: 'landing' })

const { t, locale } = useI18n()
const supabase = useSupabaseClient<SupportRpcDatabase>().schema('public')
const user = useSupabaseUser()
const form = reactive({ category: 'general', subject: '', message: '', email: '', consent: false, honeypot: '' })
const pending = ref(false)
const sent = ref(false)
const error = ref('')
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const contactInfo = computed(() => [
  { key: 'email', label: t('marketing.email'), value: publicBusiness.supportEmail, href: `mailto:${publicBusiness.supportEmail}`, direction: 'ltr' as const },
  { key: 'phone', label: t('marketing.phone'), value: publicBusiness.phone, href: `tel:${publicBusiness.phone}`, direction: 'ltr' as const },
  { key: 'address', label: t('marketing.businessAddress'), value: locale.value === 'ar' ? publicBusiness.addressAr : publicBusiness.addressEn },
])
const categories = computed(() => ['general', 'product', 'billing', 'technical', 'account'].map(value => ({ value, label: t(`marketing.contactCategories.${value}`) })))
const formCopy = computed(() => ({ title: t('marketing.contactFormTitle'), intro: t('marketing.contactFormIntro'), category: t('marketing.contactCategory'), replyEmail: t('marketing.contactReplyEmail'), subject: t('marketing.contactSubject'), message: t('marketing.contactMessage'), consent: t('marketing.contactConsent'), success: t('marketing.contactSuccess'), submit: t('marketing.contactSubmit'), pending: t('marketing.contactPending'), website: 'Website' }))

watch(user, (value) => {
  if (value?.email && !form.email) form.email = value.email
}, { immediate: true })

async function submit() {
  error.value = ''
  sent.value = false
  if (!form.subject.trim() || !form.message.trim() || !emailPattern.test(form.email.trim()) || !form.consent) {
    error.value = t('marketing.contactValidation')
    return
  }
  pending.value = true
  try {
    const { error: failure } = await supabase.rpc('submit_support_request', {
      p_category: form.category,
      p_subject: form.subject,
      p_message: form.message,
      p_reply_email: form.email,
      p_consent: form.consent,
      p_honeypot: form.honeypot,
    })
    if (failure) {
      error.value = failure.message.includes('SUPPORT_RATE_LIMITED')
        ? t('marketing.contactRateLimited')
        : t('marketing.contactError')
      return
    }
    sent.value = true
    form.subject = ''
    form.message = ''
    form.consent = false
  }
  catch {
    error.value = t('marketing.contactError')
  }
  finally {
    pending.value = false
  }
}

useHead(() => ({
  title: `${t('marketing.contact')} · Shop Suit`,
  meta: [{ name: 'description', content: t('marketing.contactMetaDescription') }],
}))
</script>

<template>
  <BsContactPage v-model="form" eyebrow="Shop Suit by Building Suit" :title="t('marketing.contact')" :intro="t('marketing.contactIntro')" :info="contactInfo" :form-copy="formCopy" :categories="categories" :identity-title="t('marketing.businessIdentity')" :identity-body="t('marketing.businessIdentityBody', { product: 'Shop Suit', parent: 'Building Suit' })" :pending="pending" :error="error" :sent="sent" @submit="submit"/>
</template>
