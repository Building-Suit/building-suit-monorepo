<script setup lang="ts">
const faqs = Array.from({ length: 8 }, (_, i) => ({
  question: `faqs.q${i + 1}`,
  answer: `faqs.a${i + 1}`,
}));
</script>

<template>
  <div id="faqs" class="bg-muted/40 py-36">
    <div class="max-w-3xl mx-auto px-4 flex flex-col gap-10">
      <div class="flex flex-col gap-4 items-center justify-center text-center">
        <h2 class="text-3xl font-bold text-primary sm:text-4xl lg:text-5xl">
          {{ $t('faqs.title') }}
          <span class="text-secondary">{{ $t('faqs.subtitle') }}</span>
        </h2>
        <p class="text-lg text-muted-foreground max-w-2xl">
          {{ $t('faqs.description') }}
        </p>
      </div>

      <Accordion type="single" collapsible class="flex flex-col gap-4 w-full">
        <AccordionItem
          v-for="(faq, n) in faqs"
          :key="n"
          :value="`item-${n}`"
          class="rounded-xl border border-border/50 bg-card px-6 shadow-sm data-[state=open]:shadow-md transition-shadow"
        >
          <AccordionTrigger
            class="text-left font-semibold text-foreground hover:no-underline py-5"
          >
            {{ $t(faq.question) }}
          </AccordionTrigger>
          <AccordionContent class="text-muted-foreground pb-5 leading-relaxed">
            {{ $t(faq.answer) }}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </div>
</template>
