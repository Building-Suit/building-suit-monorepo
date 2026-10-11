<script setup lang="ts">
const { locale } = useI18n()
const route = useRoute()
const arabic = computed(() => locale.value === 'ar')
const shop = computed(() => route.query.suit === 'shop')
const tab = ref('members')
const memberForm = ref({ name: 'Sample member', jobTitle: 'Team', email: 'member@example.invalid', role: 'staff', locationIds: ['main'] })
const roleForm = ref({ name: 'Staff', nameAr: 'فريق', permissions: ['read'] })
const memberVisible = ref(false)
const roleVisible = ref(false)
const { dirty: memberDirty } = useRecordAction(() => memberForm.value, memberVisible)
const { dirty: roleDirty } = useRecordAction(() => roleForm.value, roleVisible)
const copy = computed(() => ({
  title: arabic.value ? 'الفريق والصلاحيات' : 'Team & permissions', subtitle: arabic.value ? 'معاينة القالب المشترك' : 'Shared template preview', members: arabic.value ? 'الأعضاء' : 'Members', roles: arabic.value ? 'الأدوار' : 'Roles', invitations: arabic.value ? 'الدعوات' : 'Invitations', noMembers: arabic.value ? 'لا يوجد أعضاء' : 'No members', noInvitations: arabic.value ? 'لا توجد دعوات' : 'No invitations', retry: arabic.value ? 'إعادة المحاولة' : 'Retry', noTeam: arabic.value ? 'لا يوجد فريق' : 'No team', newRole: arabic.value ? 'دور جديد' : 'New role',
  memberColumns: { name: arabic.value ? 'الاسم' : 'Name', role: arabic.value ? 'الدور' : 'Role', status: arabic.value ? 'الحالة' : 'Status', actions: arabic.value ? 'الإجراءات' : 'Actions', ...(shop.value ? { locations: arabic.value ? 'الفروع' : 'Locations' } : { joined: arabic.value ? 'تاريخ الانضمام' : 'Joined' }) },
  invitationColumns: { email: arabic.value ? 'البريد الإلكتروني' : 'Email', role: arabic.value ? 'الدور' : 'Role', status: arabic.value ? 'الحالة' : 'Status', sent: arabic.value ? 'التاريخ' : 'Date', actions: arabic.value ? 'الإجراءات' : 'Actions' },
}))
const edit = computed(() => arabic.value ? 'تعديل' : 'Edit')
const state = (visible: boolean, title: string, dirty: boolean) => ({ visible, title, dirty, pending: false, submitLabel: arabic.value ? 'حفظ' : 'Save', cancelLabel: arabic.value ? 'إلغاء' : 'Cancel' })
const memberEditor = computed(() => ({ state: state(memberVisible.value, edit.value, memberDirty.value), copy: { ...(shop.value ? { name: copy.value.memberColumns.name, jobTitle: arabic.value ? 'المسمى الوظيفي' : 'Job title', locations: arabic.value ? 'الفروع' : 'Locations' } : {}), email: copy.value.invitationColumns.email, role: copy.value.memberColumns.role }, roles: [{ value: 'staff', label: arabic.value ? 'فريق' : 'Staff' }, { value: 'viewer', label: arabic.value ? 'مشاهد' : 'Viewer' }], ...(shop.value ? { locations: [{ id: 'main', name: arabic.value ? 'الفرع الرئيسي' : 'Main location' }] } : {}) }))
const roleEditor = computed(() => ({ state: state(roleVisible.value, copy.value.roles, roleDirty.value), names: { english: 'English name', arabic: 'الاسم بالعربية', maxLength: 80 }, permissionLabel: arabic.value ? 'الصلاحيات' : 'Permissions', permissions: [{ key: 'read', label: arabic.value ? 'قراءة' : 'Read', disabled: true }, { key: 'manage', label: arabic.value ? 'إدارة' : 'Manage' }] }))
const members = computed(() => [{ id: 'member', name: 'Sample member', email: 'member@example.invalid', role: 'Staff', status: 'active', joined: '2026-01-01', locations: 'Main location', actions: [{ key: 'edit' as const, label: edit.value }] }])
const roles = computed(() => [{ id: 'staff', label: 'Staff', permissions: 'Read', actions: [{ key: 'edit' as const, label: edit.value }] }])
const invitations = computed(() => [{ id: 'invitation', email: 'invited@example.invalid', role: 'Viewer', status: 'pending', sent: '2026-01-01', actions: [] }])
const tabs = computed(() => [{ key: 'members', label: copy.value.members, count: members.value.length }, { key: 'roles', label: copy.value.roles, count: roles.value.length }, { key: 'invitations', label: copy.value.invitations, count: invitations.value.length }])
</script>
<template>
  <BsAccessManagementPage v-model:active-tab="tab" v-model:member-form="memberForm" v-model:role-form="roleForm" :copy="copy" :tabs="tabs" :members="members" :roles="roles" :invitations="invitations" :member-editor="memberEditor" :role-editor="roleEditor" can-create-role @member-action="memberVisible = true" @role-action="roleVisible = true" @create-role="roleVisible = true" @close-member="memberVisible = false" @close-role="roleVisible = false" @submit-member="memberVisible = false" @submit-role="roleVisible = false" />
</template>
