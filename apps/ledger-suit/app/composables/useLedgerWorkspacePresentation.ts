import type { BsWorkspaceCreationForm, BsWorkspaceCreationView } from '@building-suit/ui/types/workspaceCreationPresentation'
import { useLedgerOrganizationSwitcherView } from './useLedgerOrganizationSwitcherView'

/** Workspace creation policy and commands stay in Ledger. */
export function useLedgerWorkspacePresentation() {
  const { t } = useI18n()
  const controller = reactive(useLedgerOrganizationSwitcherView())
  const selector = computed(() => controller.current ? { value: controller.current.id, label: t('org.switcher'), placeholder: t('org.none'), options: controller.contextOptions, createLabel: !controller.ownsOrganization ? t('org.createAnother') : undefined } : undefined)
  const form = computed<BsWorkspaceCreationForm>({ get: () => ({ name: controller.name, legalName: controller.legalName, currency: controller.currency }), set: value => { controller.name = value.name; controller.legalName = value.legalName; controller.currency = value.currency } })
  const view = computed<BsWorkspaceCreationView>(() => ({ visible: controller.createOpen, pending: controller.pending, dirty: controller.overlayDirty0, error: controller.errorMessage, currencies: ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'], copy: { title: t('org.createAnother'), eyebrow: t('org.additionalEyebrow'), hint: t('org.additionalBillingHint'), name: t('org.name'), legalName: t('onboarding.legalName'), currency: t('accounts.currency'), separateTitle: t('org.separateSubscriptionTitle'), separateBody: t('org.separateSubscriptionBody'), cancel: t('common.cancel'), create: t('org.createAndStartTrial') } }))
  return { selector, form, view, choose: controller.choose, open: controller.showCreate, close: controller.closeCreate, submit: controller.createAndStartTrial }
}
