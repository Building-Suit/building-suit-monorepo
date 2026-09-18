# EDIT — activate Inventory + Expenses in `apps/shop-crm/app/layouts/default.vue`

After Batch 04 the sidebar should already have active:

```text
Dashboard
Invoices
Products
Services
```

and `plannedNav` should still contain Inventory, Expenses, Team, Reports.

## 1. Remove Inventory + Expenses from `plannedNav`

Change:

```ts
const plannedNav = computed(() => [
  { label: copy.value.inventory, icon: 'lucide:warehouse' },
  { label: copy.value.expenses, icon: 'lucide:wallet-cards' },
  { label: copy.value.team, icon: 'lucide:users-round' },
  { label: copy.value.reports, icon: 'lucide:chart-no-axes-combined' },
])
```

to:

```ts
const plannedNav = computed(() => [
  { label: copy.value.team, icon: 'lucide:users-round' },
  { label: copy.value.reports, icon: 'lucide:chart-no-axes-combined' },
])
```

## 2. Add active links after Services

```vue
<NuxtLink
  to="/inventory"
  class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
  :class="isActive('/inventory')
    ? 'bg-[#d89b42] text-[#0b0b0d]'
    : 'text-white/65 hover:bg-white/5 hover:text-white'"
>
  <Icon name="lucide:warehouse" class="size-[18px]" />
  <span>{{ copy.inventory }}</span>
</NuxtLink>

<NuxtLink
  to="/expenses"
  class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
  :class="isActive('/expenses')
    ? 'bg-[#d89b42] text-[#0b0b0d]'
    : 'text-white/65 hover:bg-white/5 hover:text-white'"
>
  <Icon name="lucide:wallet-cards" class="size-[18px]" />
  <span>{{ copy.expenses }}</span>
</NuxtLink>
```

Keep the divider below these operational links.
