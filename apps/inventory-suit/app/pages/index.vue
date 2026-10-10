<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('product.name') })
</script>
<template>
  <BsPage width="sm" padding="none">
    <BsCard as="section" padding="lg">
      <BsStack gap="sm">
        <BsHeading :level="1">
          {{ t('welcome') }}
        </BsHeading>
        <BsText tone="muted">
          {{ t('description') }}
        </BsText>
      </BsStack>
    </BsCard>
  </BsPage>
</template>
