# EDIT — activate Products + Services in `apps/shop-crm/app/layouts/default.vue`

## 1. Add localized copy

Arabic:
```ts
services: 'الخدمات',
```

English:
```ts
services: 'Services',
```

Place beside the existing `products` copy entry.

## 2. Remove Products from `plannedNav`

Change:
```ts
const plannedNav = computed(() => [
  { label: copy.value.products, icon: 'lucide:package' },
  { label: copy.value.inventory, icon: 'lucide:warehouse' },
  { label: copy.value.expenses, icon: 'lucide:wallet-cards' },
  { label: copy.value.team, icon: 'lucide:users-round' },
  { label: copy.value.reports, icon: 'lucide:chart-no-axes-combined' },
])
```

to:
```ts
const plannedNav = computed(() => [
  { label: copy.value.inventory, icon: 'lucide:warehouse' },
  { label: copy.value.expenses, icon: 'lucide:wallet-cards' },
  { label: copy.value.team, icon: 'lucide:users-round' },
  { label: copy.value.reports, icon: 'lucide:chart-no-axes-combined' },
])
```

## 3. Add active links after Invoices

```vue
<NuxtLink
  to="/products"
  class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
  :class="isActive('/products')
    ? 'bg-[#d89b42] text-[#0b0b0d]'
    : 'text-white/65 hover:bg-white/5 hover:text-white'"
>
  <Icon name="lucide:package" class="size-[18px]" />
  <span>{{ copy.products }}</span>
</NuxtLink>

<NuxtLink
  to="/services"
  class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition"
  :class="isActive('/services')
    ? 'bg-[#d89b42] text-[#0b0b0d]'
    : 'text-white/65 hover:bg-white/5 hover:text-white'"
>
  <Icon name="lucide:briefcase-business" class="size-[18px]" />
  <span>{{ copy.services }}</span>
</NuxtLink>
```
