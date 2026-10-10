<script setup lang="ts">
const { locale } = useI18n()
const ar = computed(() => locale.value === 'ar')
const copy = (en: string, arabic: string) => ar.value ? arabic : en
const stage = ref('file')
const file = ref<File | null>(null)
const mapping = ref<Record<string, string | null>>({ name: 'name' })
const expanded = ref(['root'])
const lines = ref([{ id: '1', name: 'Paper', quantity: 2 }])
const nextLine = ref(2)
const inviteVisible = ref(false)
const email = ref('')
const role = ref<string | null>('viewer')
const choice = ref<string | number | Array<string | number> | null>('team')
const tags = ref([{ id: 'reviewed', label: 'Reviewed' }])
const state = ref<string | number | null>('data')
const pending = ref(false)
const feedback = ref('')
const usage = computed(() => [{ id: 'members', label: copy('Team capacity', 'سعة الفريق'), valueLabel: '8 / 10', used: 8, limit: 10, status: copy('Near capacity', 'قريب من الحد'), tone: 'warning' as const }, { id: 'storage', label: copy('Storage', 'التخزين'), valueLabel: copy('Unlimited', 'غير محدود'), used: 500, limit: null }])
const steps = computed(() => [{ id: 'workspace', title: copy('Workspace', 'مساحة العمل'), status: copy('Complete', 'مكتمل'), tone: 'success' as const }, { id: 'team', title: copy('Invite your team', 'دعوة الفريق'), status: copy('Pending', 'قيد الانتظار'), action: { label: copy('Invite', 'دعوة') } }])
const nodes = computed(() => [{ id: 'root', label: copy('Workspace', 'مساحة العمل'), children: [{ id: 'first', label: copy('Operations', 'العمليات') }, { id: 'second', label: copy('A long department name that wraps naturally', 'اسم قسم طويل يلتف بشكل طبيعي') }] }])
const roles = computed(() => [{ value: 'viewer', label: copy('Viewer', 'مشاهد') }, { value: 'editor', label: copy('Editor', 'محرر') }])
const columns = computed(() => [{ key: 'name', field: 'name', header: copy('Name', 'الاسم') }, { key: 'status', field: 'status', header: copy('Status', 'الحالة') }])
const importSteps = computed(() => [{ id: 'file', label: copy('File', 'ملف') }, { id: 'mapping', label: copy('Mapping', 'تعيين') }, { id: 'review', label: copy('Review', 'مراجعة') }, { id: 'result', label: copy('Result', 'نتيجة') }])
function move(offset: number) { stage.value = importSteps.value[importSteps.value.findIndex(item => item.id === stage.value) + offset]?.id || stage.value }
function print() { window.print() }
</script>

<template>
  <BsContentSection :title="copy('Workflow and presentation families', 'عائلات العرض وسير العمل')" :description="copy('Synthetic inputs; commands and policy stay in products.', 'بيانات تجريبية؛ تبقى الأوامر والسياسات في المنتج.')">
    <BsStack gap="lg">
      <BsInline gap="md" wrap>
        <BsMoneyText amount="9223372036854775807" currency="EGP" :locale="locale" />
        <BsMoneyText amount="-12345" currency="USD" :locale="locale" accounting />
        <BsMoneyText amount="12.34" unit="major" currency="EGP" :locale="locale" explicit-sign />
        <BsSelect v-model="state" :label="copy('Example state', 'حالة المثال')" :options="['data', 'loading', 'error', 'empty'].map(value => ({ label: value, value }))" option-label="label" option-value="value" />
        <BsSwitch v-model="pending" :label="copy('Pending actions', 'إجراءات معلقة')" />
      </BsInline>
      <BsUsageMeterGrid :items="usage" :columns="2" />
      <BsSetupChecklist :title="copy('Setup checklist', 'قائمة الإعداد')" :progress-label="copy('1 of 2 complete', 'اكتملت خطوة من خطوتين')" :steps="state === 'empty' ? [] : steps" :loading="state === 'loading'" :error="state === 'error' ? copy('Setup unavailable', 'الإعداد غير متاح') : null" :empty-label="copy('No steps', 'لا توجد خطوات')" :retry-label="copy('Retry', 'إعادة المحاولة')" @retry="state = 'data'" @action="inviteVisible = true" />
      <BsOnboardingPanel v-model="choice" :title="copy('Choose your starting point', 'اختر نقطة البداية')" :legend="copy('Setup path', 'مسار الإعداد')" :options="[{ value: 'team', label: copy('Invite a team', 'دعوة فريق') }, { value: 'import', label: copy('Import records', 'استيراد السجلات') }]" :action-label="copy('Continue', 'متابعة')" :pending="pending" />
      <BsImportWizard :title="copy('Import records', 'استيراد السجلات')" :steps="importSteps" :step="stage" :pending="pending" can-advance :next-label="copy('Next', 'التالي')" :back-label="copy('Back', 'السابق')" @next="move(1)" @back="move(-1)">
        <BsFileDrop v-if="stage === 'file'" v-model="file" :label="copy('Choose or drop a file', 'اختر ملفاً أو أسقطه')" accept=".csv" :description="copy('The product validates and parses the file.', 'يتحقق المنتج من الملف ويحلل محتواه.')" :disabled="pending" />
        <BsColumnMapping v-else-if="stage === 'mapping'" v-model="mapping" :fields="[{ key: 'name', label: copy('Name', 'الاسم'), required: true }]" :columns="[{ label: 'name', value: 'name' }]" :disabled="pending" />
        <BsStack v-else-if="stage === 'review'" gap="md"><BsImportValidationSummary :title="copy('Validation', 'التحقق')" :summary="copy('One row needs review', 'صف واحد يحتاج إلى المراجعة')" :issues="[{ id: '1', message: copy('Missing value', 'قيمة مفقودة'), detail: copy('Row 2: name is required', 'الصف ٢: الاسم مطلوب') }]" tone="warning" /><BsImportPreview :rows="[{ name: 'Example' }]" :columns="[{ key: 'name', field: 'name', header: copy('Name', 'الاسم') }]" :label="copy('Preview', 'معاينة')" /></BsStack>
        <BsImportResult v-else :title="copy('Import complete', 'اكتمل الاستيراد')" :description="copy('One synthetic record imported', 'تم استيراد سجل تجريبي واحد')" success :action-label="copy('Start again', 'البدء مجدداً')" @restart="stage = 'file'" />
      </BsImportWizard>
      <BsTeamTable :members="state === 'empty' ? [] : [{ name: 'Demo member', status: copy('Active', 'نشط') }]" :columns="columns" row-key="name" :label="copy('Team', 'الفريق')" :capabilities="{ insert: true, edit: true }" :action-labels="{ insert: copy('Invite', 'دعوة') }" :loading="state === 'loading'" :error="state === 'error' ? copy('Members unavailable', 'الأعضاء غير متاحين') : null" :capacity-notice="copy('2 places available', 'مكانان متاحان')" @invite="inviteVisible = true" @retry="state = 'data'" />
      <BsInviteMemberDialog v-model:visible="inviteVisible" v-model:email="email" v-model:role="role" :title="copy('Invite member', 'دعوة عضو')" :email-label="copy('Email', 'البريد الإلكتروني')" :role-label="copy('Role', 'الدور')" :roles="roles" :submit-label="copy('Invite', 'دعوة')" :cancel-label="copy('Cancel', 'إلغاء')" :dirty="!!email" :pending="pending" @submit="inviteVisible = false" />
      <BsReviewPanel :title="copy('Review extracted values', 'مراجعة القيم المستخرجة')" :approve-label="copy('Approve', 'موافقة')" :reject-label="copy('Reject', 'رفض')" can-approve can-reject :pending="pending" @approve="feedback = copy('Approved', 'تمت الموافقة')" @reject="feedback = copy('Rejected', 'تم الرفض')"><BsDescriptionList><BsDescriptionItem :term="copy('Name', 'الاسم')">Example</BsDescriptionItem></BsDescriptionList></BsReviewPanel>
      <BsText v-if="feedback" role="status">{{ feedback }}</BsText>
      <BsTagPicker :tags="tags" :options="[{ id: 'reviewed', label: copy('Reviewed', 'تمت المراجعة') }, { id: 'priority', label: copy('Priority', 'أولوية') }]" :label="copy('Tags', 'الوسوم')" :add-label="copy('Assign', 'تعيين')" :remove-label="copy('Remove', 'إزالة')" :empty-label="copy('No tags assigned', 'لم يتم تعيين وسوم')" :pending="pending" @remove="tags = tags.filter(tag => tag.id !== $event)" @add="tags.push({ id: $event, label: copy('Priority', 'أولوية') })" />
      <BsMetricBarChart :label="copy('Monthly activity', 'النشاط الشهري')" :series="[{ id: 'first', label: copy('Received', 'مستلم'), tone: 'success' }, { id: 'second', label: copy('Used', 'مستخدم'), tone: 'info' }]" :point-label="copy('Month', 'الشهر')" :table-series="[{ id: 'first', label: copy('Received', 'مستلم') }, { id: 'second', label: copy('Used', 'مستخدم') }, { id: 'net', label: copy('Net', 'الصافي') }]" :points="state === 'empty' ? [] : [{ id: 'oct', label: copy('October', 'أكتوبر'), values: { first: 12, second: 8, net: 4 } }, { id: 'nov', label: copy('November', 'نوفمبر'), values: { first: 18, second: -4, net: 22 } }]" :table-label="copy('Show values as a table', 'عرض القيم في جدول')" :empty-label="copy('No activity', 'لا يوجد نشاط')" :loading="state === 'loading'" :error="state === 'error' ? copy('Chart unavailable', 'الرسم غير متاح') : null" />
      <BsHierarchyTree v-model:expanded="expanded" :nodes="nodes" :label="copy('Hierarchy', 'التسلسل الهرمي')" :expand-label="copy('Expand', 'توسيع')" :collapse-label="copy('Collapse', 'طي')" :empty-label="copy('No nodes', 'لا توجد عناصر')" :disabled="pending" />
      <BsFlowMap :label="copy('Workflow map', 'خريطة سير العمل')" :stages="[{ id: 'setup', title: copy('Prepare', 'تحضير'), nodes: steps }, { id: 'review', title: copy('Review', 'مراجعة'), nodes: steps.slice(0, 1) }]" />
      <BsLineItemsEditor :items="lines" :label="copy('Line items', 'البنود')" :add-label="copy('Add line', 'إضافة بند')" :remove-label="copy('Remove line', 'إزالة البند')" :row-label="(_, index) => copy(`Line ${index + 1}`, `البند ${index + 1}`)" :min-rows="1" :pending="pending" @add="lines.push({ id: String(nextLine++), name: '', quantity: 1 })" @remove="lines = lines.filter(line => line.id !== $event.id)"><template #default="{ item, disabled }"><BsField :label="copy('Item', 'الصنف')"><BsInput v-model="item.name" :disabled="disabled" /></BsField><BsQuantityInput v-model="item.quantity" :label="copy('Quantity', 'الكمية')" :min="1" :disabled="disabled" /></template></BsLineItemsEditor>
      <BsPrintableDocument :label="copy('Example receipt', 'إيصال تجريبي')" format="receipt"><template #actions><BsPrintActions :print-label="copy('Print', 'طباعة')" @print="print" /></template><template #header><BsDocumentHeader :title="copy('Receipt', 'إيصال')" :issuer="copy('Example workspace', 'مساحة عمل تجريبية')" reference="DEMO-001" date="2026-10-06" /></template><BsDocumentLines :lines="[{ id: '1', label: copy('Paper', 'ورق'), quantity: '2', unitPrice: '10.00', total: '20.00' }]" :label="copy('Items', 'الأصناف')" :item-label="copy('Item', 'الصنف')" :quantity-label="copy('Quantity', 'الكمية')" :price-label="copy('Unit price', 'سعر الوحدة')" :total-label="copy('Total', 'الإجمالي')" /><template #totals><BsDocumentTotals :totals="[{ id: 'total', label: copy('Total', 'الإجمالي'), value: '20.00 EGP', emphasis: true }]" :label="copy('Totals', 'الإجماليات')" /></template></BsPrintableDocument>
    </BsStack>
  </BsContentSection>
</template>
