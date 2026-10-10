<script setup lang="ts">
import type { BsDocumentLine } from '@building-suit/contracts'
defineProps<{ lines: BsDocumentLine[]; label: string; itemLabel: string; quantityLabel: string; priceLabel: string; totalLabel: string }>()
</script>

<template>
  <div class="bs-document-lines">
    <table>
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ itemLabel }}</th>
          <th scope="col">{{ quantityLabel }}</th>
          <th scope="col">{{ priceLabel }}</th>
          <th scope="col">{{ totalLabel }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.id">
          <th scope="row">{{ line.label }}<small v-if="line.description">{{ line.description }}</small>
          </th>
          <td dir="auto">{{ line.quantity }}</td>
          <td dir="auto">{{ line.unitPrice }}</td>
          <td dir="auto">{{ line.total }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
