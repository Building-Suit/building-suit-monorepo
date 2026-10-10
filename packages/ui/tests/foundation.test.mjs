import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as vue from 'vue'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function component(file, language = 'en') {
  const { descriptor } = parse(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: file, inlineTemplate: true })
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const copy = language === 'ar' ? { close: 'إغلاق', saving: 'جارٍ الحفظ…', search: 'بحث', empty: 'لا توجد سجلات' } : { close: 'Close', saving: 'Saving…', search: 'Search', empty: 'No records found' }
  const globals = { ref: vue.ref, computed: vue.computed, watch: vue.watch, watchEffect: vue.watchEffect, nextTick: vue.nextTick, onMounted: vue.onMounted, onBeforeUnmount: vue.onBeforeUnmount, useId: vue.useId, useAttrs: vue.useAttrs, useSlots: vue.useSlots, useI18n: () => ({ t: key => key, te: () => false }), useToasts: () => ({ toasts: vue.ref([{ id: 1, title: 'Saved', tone: 'success' }]), dismiss: () => {} }), useUiCopy: () => key => copy[key] }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(require, module, module.exports, ...Object.values(globals))
  return module.exports.default
}
async function render(file, props, slot, language) {
  const app = vue.createSSRApp({ render: () => vue.h(component(file, language), props, slot ? () => slot : undefined) })
  app.component('BsIcon', { render: () => vue.h('svg', { 'aria-hidden': 'true' }) })
  app.config.globalProperties.$primevue = { config: { unstyled: true, locale: { emptySelectionMessage: 'No selection', selectionMessage: '{0} selected' } } }
  return renderToString(app)
}

test('PrimeVue button defaults safely and preserves explicit submit/label/disabled semantics', async () => {
  const button = await render('atoms/BsButton.vue', { 'aria-label': 'Remove line', pending: true, disabled: false }, 'Remove')
  assert.match(button, /type="button"/)
  assert.match(button, /aria-label="Remove line"/)
  assert.match(button, /aria-busy="true"/)
  assert.match(button, / disabled/)
  assert.match(button, /ls-btn/)
  assert.match(await render('atoms/BsButton.vue', { type: 'submit' }, 'Save'), /type="submit"/)
  assert.match(await render('atoms/BsButton.vue', { variant: 'danger', size: 'sm' }, 'Remove'), /ls-btn-danger/)
  assert.match(await render('atoms/BsButton.vue', { variant: 'danger', size: 'sm' }, 'Remove'), /ls-btn-sm/)
})

test('semantic action variants do not inherit default button chrome', async () => {
  for (const variant of ['text', 'link', 'icon', 'tab', 'chip', 'tile']) {
    const html = await render('atoms/BsButton.vue', { variant, 'aria-label': variant }, variant)
    assert.match(html, new RegExp(`ls-action-${variant === 'link' ? 'text' : variant}`))
    assert.doesNotMatch(html, /class="[^"]*\bls-btn\b/)
  }
  assert.match(await render('atoms/BsButton.vue', { severity: 'secondary' }, 'Secondary'), /ls-btn-secondary/)
})

test('primitive inventory centrally owns fields, choices, states, navigation, and composition', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const component of ['BsAppRoot', 'BsBox', 'BsPage', 'BsPageBody', 'BsContainer', 'BsStack', 'BsInline', 'BsGrid', 'BsText', 'BsHeading', 'BsLink', 'BsIcon', 'BsImage', 'BsDivider', 'BsList', 'BsListItem', 'BsDescriptionList', 'BsDescriptionItem', 'BsDisclosure', 'BsCodeBlock', 'BsVisuallyHidden', 'BsSurface', 'BsPanel', 'BsActionTile', 'BsInteractiveCard', 'BsAlert', 'BsSkeleton', 'BsStatusBadge', 'BsInput', 'BsTextarea', 'BsSelect', 'BsCheckbox', 'BsRadio', 'BsSwitch', 'BsFileInput', 'BsOtpInput', 'BsField', 'BsFieldGroup', 'BsChoiceGroup', 'BsSearchField', 'BsDateRangeFilter', 'BsForm', 'BsFormSection', 'BsFormActions', 'BsFilterBar', 'BsTabs', 'BsSegmentedControl', 'BsPagination', 'BsStateSurface', 'BsSectionHeader', 'BsContentSection', 'BsToolbar', 'BsMenu']) {
    assert.ok(Object.keys(manifest.exports).some(key => key.endsWith(`/${component}`)), `${component} is not exported`)
  }
  const styles = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')
  for (const className of ['ls-field', 'ls-choice-group', 'bs-check-control', 'bs-switch', 'bs-file-input', 'bs-otp-input', 'bs-field-group', 'bs-form-actions', 'bs-search-field', 'ls-tabs', 'ls-state-surface', 'ls-pagination', 'ls-section-header', 'ls-toolbar', 'ls-menu__panel']) {
    assert.match(styles, new RegExp(`\\.${className.replaceAll('-', '\\-')}`))
  }
  const empty = readFileSync(new URL('../src/molecules/BsEmptyState.vue', import.meta.url), 'utf8')
  assert.match(empty, /<BsStateSurface state="empty"/)
  assert.doesNotMatch(empty, /<button\b/)
})

test('shared marketing owns the landing frame and Ledger-derived pricing presentation', () => {
  const landing = readFileSync(new URL('../src/templates/BsLandingPage.vue', import.meta.url), 'utf8')
  const frame = readFileSync(new URL('../src/templates/BsMarketingLayout.vue', import.meta.url), 'utf8')
  const pricing = readFileSync(new URL('../src/organisms/BsMarketingPricing.vue', import.meta.url), 'utf8')
  const header = readFileSync(new URL('../src/organisms/BsLandingTopHeader.vue', import.meta.url), 'utf8')
  const footer = readFileSync(new URL('../src/organisms/BsLandingFooter.vue', import.meta.url), 'utf8')
  const planCard = readFileSync(new URL('../src/organisms/BsPlanCard.vue', import.meta.url), 'utf8')
  assert.match(frame, /<BsLandingTopHeader\b/)
  assert.match(frame, /<BsLandingFooter\b/)
  assert.match(header, /id="marketing-mobile-navigation"/)
  assert.match(footer, /<footer class="bs-marketing-footer/)
  for (const component of ['BsLandingHero', 'BsLandingSection', 'BsFeatureGrid', 'BsWorkflowSteps', 'BsProductPreview']) assert.match(landing, new RegExp(`<${component}\\b`))
  assert.match(pricing, /<BsBillingCycleToggle\b/)
  assert.match(pricing, /<BsPlanGrid\b/)
  assert.match(planCard, /<BsPlanFeatureList\b/)
  assert.match(planCard, /<BsPlanStatus\b/)
  assert.match(planCard, /<NuxtLink v-if="plan\.action\?\.to/)
  assert.match(planCard, /<BsButton v-else-if="plan\.action"/)
  assert.match(pricing, /<BsStateSurface v-if="loading/)
})

test('contact and public legal routes consume shared presentation directly', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const name of ['BsContactPage', 'BsSupportRequestForm', 'BsContactInfoGrid', 'BsPublicLegalPage']) assert.ok(Object.keys(manifest.exports).some(key => key.endsWith(`/${name}`)))
  for (const suit of ['ledger-suit', 'shop-suit']) {
    const contact = readFileSync(path.join(workspaceRoot, `apps/${suit}/app/pages/contact.vue`), 'utf8')
    assert.match(contact, /<BsContactPage\b/)
    assert.doesNotMatch(contact, /<(?:main|section|form|input|select|textarea)\b/)
    assert.equal(existsSync(path.join(workspaceRoot, `apps/${suit}/app/components/PublicLegalPage.vue`)), false)
    for (const page of ['about', 'privacy', 'terms', 'delivery-shipping', 'refund-cancellation']) assert.match(readFileSync(path.join(workspaceRoot, `apps/${suit}/app/pages/${page}.vue`), 'utf8'), /<BsPublicLegalPage\b/)
  }
})

test('shared auth owns split geometry, form shells, wizard controls, and verification presentation', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const name of ['BsAuthForm', 'BsSignupWizard', 'BsVerificationForm', 'BsAuthLayout']) {
    assert.ok(Object.keys(manifest.exports).some(key => key.endsWith(`/${name}`)), `${name} is not exported`)
  }

  const layout = readFileSync(new URL('../src/templates/BsAuthLayout.vue', import.meta.url), 'utf8')
  assert.match(layout, /class="bs-auth-layout ls-auth-page"/)
  assert.match(layout, /grid-template-columns: minmax\(0, \.92fr\) minmax\(0, 1\.08fr\)/)
  assert.match(layout, /bs-auth-layout__form-shell--wide/)

  const authForm = readFileSync(new URL('../src/organisms/BsAuthForm.vue', import.meta.url), 'utf8')
  assert.match(authForm, /<BsForm[^>]+:pending="pending"[^>]+:error="error"/s)
  assert.match(authForm, /<BsButton type="submit" variant="primary"/)

  const wizard = readFileSync(new URL('../src/organisms/BsSignupWizard.vue', import.meta.url), 'utf8')
  assert.match(wizard, /v-for="\(item, index\) in steps"/)
  assert.match(wizard, /:aria-current="index \+ 1 === step \? 'step'/)
  assert.match(wizard, /<BsButton v-if="step > 1"[^>]+@click="emit\('back'\)"/s)
  assert.match(wizard, /<BsButton type="submit" variant="primary"/)

  const verification = readFileSync(new URL('../src/organisms/BsVerificationForm.vue', import.meta.url), 'utf8')
  assert.match(verification, /<BsOtpInput v-if="!verified" v-model="code"/)
  assert.match(verification, /aria-live="polite"/)
  assert.match(verification, /@click="emit\('resend'\)"/)
})

test('authenticated chrome is composed from canonical shared organisms', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  for (const name of ['BsSideMenu', 'BsTopHeader', 'BsUserMenu', 'BsSettingsMenu', 'BsContextSwitcher', 'BsScopeSwitcher', 'BsNotificationMenu', 'BsTrialCountdown', 'BsReadOnlyBanner', 'BsAccessGate', 'BsAppShell']) {
    assert.ok(Object.keys(manifest.exports).some(key => key.endsWith(`/${name}`)), `${name} is not exported`)
  }
  const shell = readFileSync(new URL('../src/templates/BsAppShell.vue', import.meta.url), 'utf8')
  const sideMenu = readFileSync(new URL('../src/organisms/BsSideMenu.vue', import.meta.url), 'utf8')
  const topHeader = readFileSync(new URL('../src/organisms/BsTopHeader.vue', import.meta.url), 'utf8')
  const userMenu = readFileSync(new URL('../src/organisms/BsUserMenu.vue', import.meta.url), 'utf8')
  assert.match(shell, /<BsSideMenu\b/)
  assert.match(shell, /<BsTopHeader\b/)
  assert.doesNotMatch(shell, /<aside\b|<header\b/)
  assert.match(sideMenu, /id="bs-primary-navigation"/)
  assert.match(sideMenu, /event\.key === 'Escape'/)
  assert.match(sideMenu, /event\.key !== 'Tab'/)
  assert.match(sideMenu, /class="fixed inset-0 z-30 ls-scrim lg:hidden"/)
  assert.match(topHeader, /aria-controls="bs-primary-navigation"/)
  assert.match(userMenu, /<BsUserIdentity\b/)
  assert.match(userMenu, /<BsSettingsMenu embedded/)
  assert.match(userMenu, /v-for="action in actions"/)
  assert.match(userMenu, /@click="emit\('signOut'\)"/)
})

test('status badges expose written labels and semantic tone instead of color alone', async () => {
  const html = await render('atoms/BsStatusBadge.vue', { status: 'custom', label: 'Needs review', tone: 'warning', icon: false })
  assert.match(html, />Needs review</)
  assert.match(html, /--bs-status-warning-bg/)
  assert.doesNotMatch(html, /<svg/)
})

test('canonical record actions compose dialog, form, guarded buttons, and shared close semantics', () => {
  const source = readFileSync(new URL('../src/organisms/BsRecordActionDialog.vue', import.meta.url), 'utf8')
  assert.match(source, /<BsDialog[^>]+:dirty="dirty"[^>]+:pending="pending"/s)
  assert.match(source, /<BsForm[^>]+:pending="pending"[^>]+:error="error"/s)
  assert.match(source, /<slot :close="close"/)
  assert.match(source, /<BsFormActions/)
  assert.match(source, /<BsButton type="submit"[^>]+:pending="pending"/s)
  const confirmHost = readFileSync(new URL('../src/organisms/BsConfirmHost.vue', import.meta.url), 'utf8')
  assert.match(confirmHost, /autofocus/)
  assert.match(confirmHost, /current\.tone === 'danger'/)
})

test('shared controls cover native field semantics and own accessible presentation', async () => {
  const input = await render('atoms/BsInput.vue', { type: 'datetime-local', modelValue: '2026-10-03T12:30', invalid: true, 'aria-describedby': 'when-help' })
  assert.match(input, /type="datetime-local"/)
  assert.match(input, /aria-invalid="true"/)
  assert.match(input, /aria-describedby="when-help"/)

  const checkbox = await render('atoms/BsCheckbox.vue', { label: 'Consent', modelValue: true, required: true, description: 'Required to continue' })
  assert.match(checkbox, /type="checkbox"/)
  assert.match(checkbox, / checked/)
  assert.match(checkbox, />Consent/)
  assert.match(checkbox, /Required to continue/)

  const radio = await render('atoms/BsRadio.vue', { label: 'Monthly', modelValue: 'monthly', value: 'monthly', name: 'cycle' })
  assert.match(radio, /type="radio"/)
  assert.match(radio, /name="cycle"/)
  assert.match(radio, / checked/)

  const toggle = await render('atoms/BsSwitch.vue', { label: 'Notifications', modelValue: true })
  assert.match(toggle, /role="switch"/)
  assert.match(toggle, / checked/)

  const field = readFileSync(new URL('../src/molecules/BsField.vue', import.meta.url), 'utf8')
  for (const relationship of ['descriptionId', 'helpId', 'errorId', 'describedby']) assert.match(field, new RegExp(relationship))
  const file = readFileSync(new URL('../src/atoms/BsFileInput.vue', import.meta.url), 'utf8')
  assert.match(file, /type="file"/)
  assert.match(file, /update:modelValue/)
  const filters = readFileSync(new URL('../src/organisms/BsFilterBar.vue', import.meta.url), 'utf8')
  assert.match(filters, /data-form-role="filter"/)
  assert.match(filters, /<BsToolbar/)
})

test('canonical data table owns typed CRUD capabilities, query adapters, and action placement', () => {
  const source = readFileSync(new URL('../src/organisms/BsDataTable.vue', import.meta.url), 'utf8')
  const contract = readFileSync(new URL('../../ux/src/index.ts', import.meta.url), 'utf8')
  for (const capability of ['insert', 'edit', 'delete', 'archive', 'void', 'export', 'select']) {
    assert.match(contract, new RegExp(`${capability}\\?: boolean`))
  }
  for (const event of ['create', 'edit', 'delete', 'archive', 'void']) {
    assert.match(source, new RegExp(`${event}: \\[`))
  }
  assert.match(contract, /interface BsDataTableQueryAdapter/)
  assert.match(source, /<BsToolbar\b/)
  assert.match(source, /<BsStateSurface v-if="error"/)
  assert.match(source, /<Column v-if="rowActions\.length"/)
  assert.match(source, /<BsButton v-if="capabilities\.insert"/)
  assert.doesNotMatch(source, /<(?:button|InputText)\b/)
})

for (const language of ['en', 'ar']) test(`form and select provide localized accessible markup (${language})`, async () => {
  const html = await render('organisms/BsForm.vue', { pending: true, error: 'Check value', class: 'grid gap-4' }, vue.h('input', { required: true, 'aria-label': 'Value' }), language)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="alert" tabindex="-1"/)
  const summaryId = html.match(/<p id="([^"]+)"/)?.[1]
  assert.ok(summaryId)
  assert.ok(html.includes(`aria-describedby="${summaryId}"`))
  assert.match(html, /<fieldset[^>]* disabled[^>]* inert/)
  assert.match(html, /grid gap-4/)
  assert.doesNotMatch(html, /<form[^>]*class="[^"]*grid/)
  assert.ok(html.includes(language === 'ar' ? 'جارٍ الحفظ…' : 'Saving…'))
  const picker = await render('molecules/BsSelect.vue', { modelValue: 'x', label: language === 'ar' ? 'الصنف' : 'Item', options: [{ id: 'x', name: 'Chosen' }], optionLabel: 'name', optionValue: 'id', virtual: true }, null, language)
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /aria-label="(?:الصنف|Item)"/)
  assert.match(picker, /Chosen/)
  const toast = await render('organisms/BsToastHost.vue', {}, null, language)
  assert.match(toast, /role="status"/); assert.match(toast, /Saved/)
  assert.match(toast, /aria-label="(?:إغلاق|Close)"/)
})

test('critical pattern text and focus colors meet contrast targets in both themes', () => {
  const tokens = JSON.parse(readFileSync(new URL('../../design-tokens/tokens.json', import.meta.url), 'utf8'))
  function color(path) {
    const value = path.split('.').reduce((node, key) => node[key], tokens).value
    return value.startsWith('{') ? color(value.slice(1, -1)) : value
  }
  function luminance(hex) {
    return hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
  }
  function contrast(first, second) {
    const a = luminance(color(first)); const b = luminance(color(second))
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  }
  for (const mode of ['light', 'dark']) {
    const role = `color.role.${mode}`
    assert.ok(contrast(`${role}.text`, `${role}.surface`) >= 4.5)
    assert.ok(contrast(`${role}.textOnPrimary`, `${role}.primary`) >= 4.5)
    assert.ok(contrast(`${role}.focusRing`, `${role}.surface`) >= 3)
    assert.ok(contrast(`${role}.focusRing`, `${role}.surfaceMuted`) >= 3)
    for (const status of ['error', 'success', 'warning']) {
      assert.ok(contrast(`${role}.text`, `color.semantic.${status}Bg${mode === 'dark' ? 'Dark' : ''}`) >= 4.5)
    }
  }
  assert.ok(contrast('color.role.dark.focusRing', 'color.brand.buildingNavy') >= 3)
  assert.ok(contrast('color.role.dark.focusRing', 'color.brand.deepStructureNavy') >= 3)
})

const workspaceRoot = new URL('../../../', import.meta.url).pathname

function vueFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(target) : entry.name.endsWith('.vue') ? [target] : []
  })
}

test('every dynamically discovered Suit local component has one approved ownership classification', () => {
  const appsDirectory = path.join(workspaceRoot, 'apps')
  const suits = readdirSync(appsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.endsWith('-suit'))
    .map(entry => entry.name)
    .sort()
  for (const suit of ['automation-suit', 'inventory-suit', 'ledger-suit', 'shop-suit']) assert.ok(suits.includes(suit))
  const actual = suits.flatMap(suit => vueFiles(path.join(appsDirectory, suit, 'app/components')))
    .map(file => path.relative(workspaceRoot, file).replaceAll(path.sep, '/')).sort()
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  const classified = manifest.components.map(component => component.path).sort()
  assert.deepEqual(classified, actual)
  assert.ok(manifest.components.every(component => component.approval && component.rationale))
  assert.ok(manifest.components.every(component => component.classification === 'product-orchestration'))
  assert.deepEqual(manifest.bypasses, [])
})

test('every dynamically discovered Suit uses shared reusable presentation without banning plain native semantics', () => {
  const appsDirectory = path.join(workspaceRoot, 'apps')
  const suits = readdirSync(appsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.endsWith('-suit'))
    .map(entry => entry.name)
  for (const suit of suits) for (const file of vueFiles(path.join(appsDirectory, suit, 'app'))) {
    const source = readFileSync(file, 'utf8')
    const relative = path.relative(workspaceRoot, file)
    assert.doesNotMatch(source, /<table\b/, `${relative} contains a native reusable data table`)
    assert.doesNotMatch(source, /<(?:button|form)\b[^>]*class=["'][^"']*(?:\bls-(?:btn|action|card)\b|rounded-(?:card|control|xl|2xl)[^"']{0,64}(?:border|bg-|p[xy]?-[0-9]))/, `${relative} owns a reusable native control recipe`)
    assert.doesNotMatch(source, /<(?:Button|Card|Tag|DataTable|Dialog|ConfirmDialog)\b/, `${relative} bypasses a Building Suit wrapper`)
    assert.doesNotMatch(source, /\b(?:window\.)?confirm\s*\(/, `${relative} bypasses shared confirmation`)
  }
})

test('workspace enforcement corroborates ownership and semantic action variants from source', () => {
  const source = readFileSync(path.join(workspaceRoot, 'tooling/checks/workspace.mjs'), 'utf8')
  assert.match(source, /product-orchestration classification lacks mechanically corroborated domain\/adaptor behavior/)
  assert.match(source, /semantic BsButton variants must not reintroduce default ls-btn chrome/)
  assert.doesNotMatch(source, /if \(\/<button\\b\/\.test\(text\)\)/)
})

test('Automation and Inventory consume the final shared presentation contracts', () => {
  const automation = vueFiles(path.join(workspaceRoot, 'apps/automation-suit/app'))
    .map(file => readFileSync(file, 'utf8')).join('\n')
  for (const component of ['BsDataTable', 'BsRecordActionDialog', 'BsButton', 'BsSelect', 'BsCard', 'BsKpiCard', 'BsStatusBadge', 'BsAppShell']) {
    assert.match(automation, new RegExp(`<${component}\\b`), `Automation does not consume ${component}`)
  }
  assert.match(readFileSync(path.join(workspaceRoot, 'apps/inventory-suit/app/pages/index.vue'), 'utf8'), /<BsCard\b/)
  assert.match(readFileSync(path.join(workspaceRoot, 'apps/inventory-suit/app/layouts/default.vue'), 'utf8'), /<BsAppShell\b/)
})

test('shared UI exports are explicit and cover every governed source', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'packages/ui/package.json'), 'utf8'))
  assert.ok(Object.keys(manifest.exports).every(key => !key.includes('*')))
  assert.ok(Object.values(manifest.exports).every(target => typeof target === 'string' && !target.includes('*')))
  const components = vueFiles(path.join(workspaceRoot, 'packages/ui/src'))
    .map(file => `./${path.relative(path.join(workspaceRoot, 'packages/ui'), file).replaceAll(path.sep, '/')}`)
  assert.ok(components.every(file => path.basename(file, '.vue').startsWith('Bs')), 'every renderable shared component must have a canonical Bs-prefixed name')
  assert.deepEqual(Object.values(manifest.exports).sort(), [...components, './src/styles/base.css'].sort())
})
