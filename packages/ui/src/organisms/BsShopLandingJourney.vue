<script setup lang="ts">
import type { LandingContent } from '@building-suit/contracts'
import type { BsLandingJourney } from '../types/landingPresentation'

defineProps<{
  journey: BsLandingJourney
  signupPath: string
  features: LandingContent['features']
  featuresTitle: string
  featuresBody: string
}>()
</script>

<template>
  <section id="workflow" class="bs-film" data-journey aria-labelledby="shop-film-title">
    <div class="bs-film__stage" data-journey-stage>
      <div class="bs-film__light" data-j-light aria-hidden="true" />
      <header class="bs-film__intro" data-j-intro>
        <p class="bs-film__signature">{{ journey.eyebrow }}</p>
        <h1 id="shop-film-title">{{ journey.title }}</h1>
        <p class="bs-film__description">{{ journey.description }}</p>
        <div class="bs-film__actions">
          <NuxtLink class="ls-btn ls-btn-accent" :to="signupPath">{{ journey.primaryAction }}<BsIcon name="arrowRight" directional /></NuxtLink>
          <a href="#features">{{ journey.secondaryAction }}</a>
        </div>
        <p class="bs-film__note">{{ journey.note }}</p>
      </header>

      <!-- Architectural set: physical planes and daylight, with the customer implied by an order and bag. -->
      <div class="bs-film__room" data-j-room aria-hidden="true">
        <div class="bs-film__window" /><div class="bs-film__window-light" />
        <div class="bs-film__wall"><span>{{ journey.preview.shop }}</span></div>
        <div class="bs-film__counter"><div class="bs-film__counter-surface" /><div class="bs-film__counter-edge" /><div class="bs-film__counter-front" /></div>
        <div class="bs-film__bag" data-j-bag><i /><span>{{ journey.preview.shop }}</span><b /></div>
        <div class="bs-film__counter-cup" data-j-counter-cup><i /></div>
      </div>
      <div class="bs-film__order" data-j-order aria-hidden="true"><span>{{ journey.preview.order }}</span><p>“{{ journey.preview.orderRequest }}”</p></div>

      <!-- This screen stays mounted through the entire shot. The bezel and deck form around it. -->
      <div class="bs-film__device" data-j-device aria-hidden="true">
        <div class="bs-film__contact-shadow" data-j-hardware />
        <div class="bs-film__lid" data-j-hardware /><i class="bs-film__camera" data-j-hardware />
        <div class="bs-film__screen" data-j-screen>
          <div class="bs-film__app">
            <aside class="bs-film__rail">
              <BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" kind="mark" />
              <span data-j-dashboard-nav><BsIcon name="reports" :size="16" /></span>
              <span class="bs-film__rail-active" data-j-pos-nav><BsIcon name="store" :size="16" /></span>
              <span data-j-sales-nav><BsIcon name="invoice" :size="16" /></span>
              <span><BsIcon name="team" :size="16" /></span>
              <i />
            </aside>
            <div class="bs-film__workspace">
              <div class="bs-film__appbar"><strong>{{ journey.preview.shop }}</strong><span>{{ journey.preview.location }}<i />{{ journey.preview.staffName }}</span></div>
              <div class="bs-film__pos" data-j-pos>
                <div class="bs-film__page-title"><h2>{{ journey.preview.register }}</h2><span>{{ journey.preview.staff }}: {{ journey.preview.staffName }}</span></div>
                <div class="bs-film__pos-columns">
                  <div class="bs-film__catalogue">
                    <div class="bs-film__panel-title">{{ journey.preview.catalog }}<span>{{ journey.preview.all }}</span></div>
                    <div class="bs-film__search" data-j-search><i class="bs-film__search-icon" /><span data-j-search-placeholder>{{ journey.preview.search }}</span><strong data-j-search-result>{{ journey.preview.item }}</strong></div>
                    <div class="bs-film__products">
                      <div v-for="(product, index) in journey.preview.products" :key="product.sku" class="bs-film__product" :data-j-product="index">
                        <div class="bs-film__product-image"><span class="bs-film__object" :class="`bs-film__object--${product.artwork}`"><i /></span></div>
                        <div class="bs-film__product-copy"><strong>{{ product.name }}</strong><span>{{ product.price }}</span><small>{{ product.sku }} <b>{{ product.stock }}</b></small></div>
                        <i v-if="index === 0" class="bs-film__selected" data-j-selected>✓</i>
                      </div>
                    </div>
                  </div>
                  <div class="bs-film__cart">
                    <div class="bs-film__panel-title">{{ journey.preview.cart }}<span data-j-count>1</span></div>
                    <p class="bs-film__empty" data-j-empty>{{ journey.preview.empty }}</p>
                    <div class="bs-film__cart-item" data-j-cart-item><strong>{{ journey.preview.item }}</strong><div><span>− <b>1</b> +</span><strong>{{ journey.preview.amount }}</strong></div></div>
                    <div class="bs-film__cart-fields">
                      <div class="bs-film__field"><span>{{ journey.preview.customer }}</span><strong>{{ journey.preview.walkIn }}<i>⌄</i></strong></div>
                      <div class="bs-film__field" data-j-method><span>{{ journey.preview.paymentLabel }}</span><strong data-j-method-trigger>{{ journey.preview.cash }}<i>⌄</i></strong>
                        <div class="bs-film__method-menu" data-j-method-menu><b data-j-cash-option>{{ journey.preview.cash }} ✓</b><span>{{ journey.preview.card }}</span><span>{{ journey.preview.bank }}</span></div>
                      </div>
                    </div>
                    <div class="bs-film__cart-footer"><div><span>{{ journey.preview.total }}</span><b class="bs-film__total"><span data-j-total-zero>{{ journey.preview.zero }}</span><span data-j-total-value>{{ journey.preview.amount }}</span></b></div><span class="bs-film__checkout" data-j-checkout>{{ journey.preview.checkout }}<BsIcon name="arrowRight" :size="14" directional /></span></div>
                  </div>
                </div>
                <span class="bs-film__added" data-j-added>✓ {{ journey.preview.added }}</span>
              </div>

              <!-- A representation of the actual consequential checkout confirmation, never a live dialog. -->
              <div class="bs-film__confirmation" data-j-confirmation>
                <div class="bs-film__dialog"><span class="bs-film__dialog-mark">?</span><h3>{{ journey.preview.confirmationTitle }}</h3><p>{{ journey.preview.confirmationBody }}</p><div><span>{{ journey.preview.cancel }}</span><b data-j-confirm-button>{{ journey.preview.confirm }}</b></div></div>
              </div>
              <div class="bs-film__receipt-view" data-j-receipt-view>
                <div class="bs-film__page-title"><h2>{{ journey.preview.receipt }}</h2><span class="bs-film__paid">✓ {{ journey.preview.paid }}</span></div>
                <div class="bs-film__receipt-tools"><span data-j-print><BsIcon name="invoice" :size="13" />{{ journey.preview.print }}</span><span>{{ journey.preview.share }}</span><small>{{ journey.preview.receiptNumber }}</small></div>
                <div class="bs-film__digital-paper"><strong>{{ journey.preview.shop }}</strong><span>{{ journey.preview.receiptNumber }}</span><div><span>{{ journey.preview.item }} × 1</span><b>{{ journey.preview.amount }}</b></div><div><span>{{ journey.preview.total }}</span><b>{{ journey.preview.amount }}</b></div><small>{{ journey.preview.payment }}</small></div>
              </div>
              <div class="bs-film__records" data-j-records>
                <div class="bs-film__page-title"><h2>{{ journey.preview.title }}</h2><span>{{ journey.preview.today }}</span></div>
                <div class="bs-film__metrics"><div><span>{{ journey.navigation.sales }}</span><strong>{{ journey.preview.amount }}</strong></div><div><span>{{ journey.preview.salesCount }}</span><strong>1</strong></div><div><span>{{ journey.preview.collections }}</span><strong>{{ journey.preview.amount }}</strong></div></div>
                <div class="bs-film__ledger-row"><BsIcon name="invoice" :size="18" /><div><strong>{{ journey.preview.receiptNumber }}</strong><span>{{ journey.preview.walkIn }}</span></div><b>{{ journey.preview.amount }}</b><span class="bs-film__paid">{{ journey.preview.paid }}</span></div>
                <div class="bs-film__stock"><span class="bs-film__stock-symbol"><BsIcon name="store" :size="22" /></span><div><strong>{{ journey.preview.item }}</strong><span>{{ journey.preview.stockLabel }}</span></div><b>{{ journey.preview.stockBefore }} <span>→</span> {{ journey.preview.stockAfter }}</b></div>
              </div>
            </div>
            <svg class="bs-film__cursor" data-j-cursor viewBox="0 0 24 28"><path d="M2 2 3 23l6-6 5 9 4-2-5-9 9-1Z" /></svg>
            <span class="bs-film__click" data-j-click />
          </div>
          <div class="bs-film__glass" />
        </div>
        <div class="bs-film__hinge" data-j-hardware />
        <div class="bs-film__deck" data-j-hardware><div class="bs-film__keys"><i v-for="key in 48" :key="key" /></div><div class="bs-film__trackpad" /></div>
        <div class="bs-film__lip" data-j-hardware />
      </div>

      <!-- Paper is a visual interpretation of the explicit browser Print action, with no hardware claim. -->
      <div class="bs-film__paper-shot" data-j-paper-shot aria-hidden="true">
        <div class="bs-film__paper" data-j-paper>
          <span class="bs-film__paper-brand">{{ journey.preview.shop }}</span><span>{{ journey.preview.receipt }}</span><small>{{ journey.preview.receiptNumber }}</small>
          <dl><div><dt>{{ journey.preview.date }}</dt><dd>{{ journey.preview.dateValue }}</dd></div><div><dt>{{ journey.preview.staff }}</dt><dd>{{ journey.preview.staffName }}</dd></div><div><dt>{{ journey.preview.customer }}</dt><dd>{{ journey.preview.walkIn }}</dd></div></dl>
          <div class="bs-film__paper-line"><span>{{ journey.preview.item }} × 1</span><b>{{ journey.preview.amount }}</b></div>
          <div class="bs-film__paper-total"><span>{{ journey.preview.total }}</span><strong>{{ journey.preview.amount }}</strong></div>
          <span>{{ journey.preview.payment }}</span><b class="bs-film__paper-paid">{{ journey.preview.paid }}</b><small>{{ journey.preview.thankYou }}</small>
          <span class="bs-film__paper-fold" />
        </div>
        <p>{{ journey.preview.printNote }}</p>
      </div>
      <div class="bs-film__record-thread" data-j-thread aria-hidden="true"><span /><i /><span /></div>
      <div class="bs-film__captions" aria-hidden="true">
        <div v-for="(chapter, index) in journey.chapters" :key="index" class="bs-film__caption" :data-j-chapter="index"><p>{{ chapter.eyebrow }}</p><h2>{{ chapter.title }}</h2><span>{{ chapter.body }}</span></div>
      </div>
      <footer class="bs-film__controls"><span class="bs-film__scroll" data-j-scroll-hint><i />{{ journey.scrollHint }}</span><span class="bs-film__disclaimer">{{ journey.illustrative }}</span><a href="#features">{{ journey.skip }}<BsIcon name="arrowRight" :size="14" directional /></a><div class="bs-film__progress" aria-hidden="true"><span data-j-progress /></div></footer>
    </div>

    <!-- Default SSR/no-JS/reduced-motion narrative; visually hidden only after a timeline is installed. -->
    <ol class="bs-film__transcript">
      <li v-for="(chapter, index) in journey.chapters" :key="chapter.eyebrow">
        <div><p>{{ chapter.eyebrow }}</p><h2>{{ chapter.title }}</h2><span>{{ chapter.body }}</span></div>
        <div class="bs-film__still" v-if="index === 2"><span>{{ journey.preview.item }}</span><strong>{{ journey.preview.amount }}</strong><small>{{ journey.preview.walkIn }} · {{ journey.preview.cash }}</small></div>
        <div class="bs-film__still" v-else-if="index === 3"><span>{{ journey.preview.confirmationTitle }}</span><strong>{{ journey.preview.confirmationBody }}</strong></div>
        <div class="bs-film__still bs-film__still--paper" v-else-if="index === 4"><span>{{ journey.preview.receiptNumber }}</span><strong>{{ journey.preview.item }} × 1</strong><b>{{ journey.preview.amount }}</b><small>{{ journey.preview.payment }}</small><small>{{ journey.preview.printNote }}</small></div>
        <div class="bs-film__still" v-else-if="index === 5"><span>{{ journey.preview.stockLabel }}</span><strong>{{ journey.preview.stockBefore }} → {{ journey.preview.stockAfter }}</strong><small>{{ journey.preview.recorded }}</small></div>
      </li>
    </ol>
    <section id="features" class="bs-film__features" aria-labelledby="shop-film-features">
      <header><h2 id="shop-film-features">{{ featuresTitle }}</h2><p>{{ featuresBody }}</p></header>
      <div class="bs-film__feature-list"><article v-for="feature in features" :key="feature.title"><BsIcon :name="feature.icon" :size="22" /><div><h3>{{ feature.title }}</h3><p>{{ feature.body }}</p></div></article></div>
    </section>
    <div class="bs-film__outro"><p>{{ journey.trust.label }}</p><h2>{{ journey.trust.heading }}</h2><span>{{ journey.trust.body }}</span><NuxtLink class="ls-btn ls-btn-accent" :to="signupPath">{{ journey.primaryAction }}<BsIcon name="arrowRight" directional /></NuxtLink></div>
  </section>
</template>

<style scoped>
/* Local aliases describe materials, all derived from the canonical Building palette. */
.bs-film { --film-navy:var(--bs-color-brand-deep-structure-navy); --film-night:var(--bs-color-brand-midnight-background); --film-gold:var(--bs-color-brand-premium-gold); --film-pearl:var(--bs-color-brand-pearl-white); --film-silver:var(--bs-color-brand-cloud-gray); --film-steel:var(--bs-color-brand-steel-border); position:relative; isolation:isolate; background:var(--film-navy); color:var(--film-pearl); scroll-margin-top:4.5rem; }
.bs-film *, .bs-film *::before, .bs-film *::after { box-sizing:border-box; }
.bs-film__stage { position:relative; overflow:hidden; overflow:clip; height:calc(100svh - var(--bs-landing-header-height,4.5rem)); height:calc(100dvh - var(--bs-landing-header-height,4.5rem)); min-height:0; perspective:1800px; background:radial-gradient(ellipse at 78% 38%, color-mix(in srgb,var(--bs-color-secondary-slate-blue) 65%,transparent),transparent 61%),var(--film-night); }
.bs-film__light { position:absolute; inset:-25%; pointer-events:none; background:radial-gradient(ellipse at 65% 40%,color-mix(in srgb,var(--film-gold) 10%,transparent),transparent 44%); }
.bs-film__intro { position:absolute; z-index:8; inset-inline-start:5.5%; top:14%; width:36%; }
.bs-film__signature { margin:0 0 24px; font-size:1rem; font-weight:700; color:var(--bs-color-brand-highlight-gold); }
.bs-film__intro h1 { margin:0; max-width:10ch; font-size:clamp(3rem,5.45vw,6.3rem); font-weight:600; line-height:1.06; letter-spacing:-.065em; text-wrap:balance; }
.bs-film__description { max-width:38ch; margin:26px 0; color:var(--film-silver); font-size:clamp(.875rem,1.1vw,1.075rem); line-height:1.85; }
.bs-film__actions { display:flex; align-items:center; flex-wrap:wrap; gap:22px; }
.bs-film__actions>a:last-child { color:var(--film-pearl); font-size:.82rem; text-decoration:underline; text-underline-offset:6px; }
.bs-film__note { color:var(--film-silver); margin-top:18px; font-size:.72rem; }
.bs-film a:focus-visible { outline:2px solid var(--bs-color-brand-highlight-gold); outline-offset:6px; }
/* Set geometry stays in physical coordinates; Arabic mirrors the copy, not the camera. */
.bs-film__room { position:absolute; inset:0; opacity:0; visibility:hidden; background:linear-gradient(90deg,var(--film-navy),var(--bs-color-brand-building-navy) 70%,var(--film-navy)); }
.bs-film__room::after { content:""; position:absolute; inset:0; pointer-events:none; background:linear-gradient(90deg,var(--film-night),color-mix(in srgb,var(--film-night) 78%,transparent) 22%,transparent 55%); }
.bs-film__wall { position:absolute; inset:0 0 25%; background:linear-gradient(90deg,transparent 62%,color-mix(in srgb,var(--film-night) 35%,transparent) 62.2%,transparent 62.5%); }
.bs-film__wall>span { position:absolute; inset-inline-end:9%; top:18%; color:color-mix(in srgb,var(--film-pearl) 23%,transparent); font-size:clamp(20px,3vw,48px); font-weight:500; letter-spacing:-.045em; }
.bs-film__window { position:absolute; left:-3%; top:-7%; width:27%; height:72%; transform:skewY(-13deg); border:14px solid var(--film-navy); background:linear-gradient(130deg,var(--bs-color-secondary-pale-sky),var(--bs-color-secondary-sky-steel)); box-shadow:inset 0 0 80px var(--bs-color-secondary-slate-blue),30px 14px 60px color-mix(in srgb,var(--film-night) 30%,transparent); }
.bs-film__window::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent 47%,var(--film-navy) 47% 50%,transparent 50%),linear-gradient(0deg,transparent 49%,var(--film-navy) 49% 52%,transparent 52%); }
.bs-film__window-light { position:absolute; left:14%; top:20%; width:77%; height:70%; transform:skew(-25deg,-12deg); opacity:.14; background:linear-gradient(90deg,transparent,var(--film-pearl) 38%,transparent); }
.bs-film__counter { position:absolute; inset:76% -10% -25%; }
.bs-film__counter-surface { position:absolute; inset:0 0 60%; background:linear-gradient(169deg,var(--bs-color-neutral-steel-gray),var(--bs-color-secondary-slate-blue) 33%,var(--film-navy) 85%); box-shadow:0 -1px color-mix(in srgb,var(--film-pearl) 45%,transparent); transform:skewY(-2deg); }
.bs-film__counter-edge { position:absolute; top:40%; width:100%; height:2%; transform:skewY(-2deg); background:var(--bs-color-secondary-sky-steel); }
.bs-film__counter-front { position:absolute; inset:42% 0 0; transform:skewY(-2deg); background:repeating-linear-gradient(90deg,transparent 0 64px,color-mix(in srgb,var(--film-night) 50%,transparent) 64px 66px),linear-gradient(var(--bs-color-brand-building-navy),var(--film-night)); }
.bs-film__bag { position:absolute; left:16%; bottom:24%; width:12%; height:27%; transform:rotate(-5deg); background:linear-gradient(100deg,var(--bs-color-gold-700),var(--bs-color-gold-300) 4%,var(--film-gold) 72%,var(--bs-color-gold-700) 73%,var(--bs-color-gold-600)); clip-path:polygon(5% 4%,88% 0,100% 12%,98% 100%,0 97%); box-shadow:12px 20px 24px color-mix(in srgb,var(--film-night) 60%,transparent); }
.bs-film__bag>i { position:absolute; width:38%; height:23%; left:28%; top:8%; border:3px solid var(--bs-color-gold-700); border-bottom:0; border-radius:50% 50% 0 0; }
.bs-film__bag>span { position:absolute; top:55%; width:76%; text-align:center; color:var(--film-navy); font-weight:600; font-size:clamp(10px,1vw,15px); }
.bs-film__bag>b { position:absolute; inset:20% 3% 0 76%; background:linear-gradient(95deg,transparent,color-mix(in srgb,var(--bs-color-gold-700) 50%,transparent)); clip-path:polygon(0 0,100% 0,80% 100%); }
.bs-film__counter-cup { position:absolute; left:76%; bottom:22%; width:7%; height:12%; border-radius:4% 4% 35% 35%; background:linear-gradient(90deg,var(--bs-color-neutral-slate-gray),var(--film-pearl) 30%,var(--film-silver) 70%,var(--bs-color-neutral-steel-gray)); box-shadow:9px 16px 20px color-mix(in srgb,var(--film-night) 65%,transparent); }
.bs-film__counter-cup::before { content:""; position:absolute; width:100%; height:20%; top:-7%; border-radius:50%; border:5px solid var(--film-silver); background:var(--bs-color-neutral-slate-gray); }
.bs-film__counter-cup>i { position:absolute; right:-32%; top:12%; width:44%; height:65%; border:8px solid var(--film-silver); border-inline-start:0; border-radius:0 50% 50% 0; }
.bs-film__order { position:absolute; z-index:4; top:17%; right:9%; width:27%; opacity:0; visibility:hidden; }
.bs-film__order>span { font-size:.75rem; color:var(--bs-color-brand-highlight-gold); }
.bs-film__order>p { font-size:clamp(1.5rem,2.6vw,3rem); line-height:1.35; font-weight:500; letter-spacing:-.035em; }
/* Machined lid, a real keyboard plane, a hinge and a contact shadow. No thick fake bezel. */
.bs-film__device { position:absolute; z-index:5; left:50%; top:54%; width:min(66vw,94svh,1060px); aspect-ratio:1.53; transform:translate(-15%,-50%) scale(.85) rotateY(-10deg) rotateX(5deg); transform-origin:50% 55%; transform-style:preserve-3d; }
.bs-film__screen { position:absolute; inset:2.2% 2.2% 17.2%; overflow:hidden; border-radius:9px; container-type:inline-size; background:var(--bs-surface); box-shadow:0 25px 70px color-mix(in srgb,var(--film-night) 75%,transparent),0 0 0 1px color-mix(in srgb,var(--film-silver) 30%,transparent); }
.bs-film__lid { position:absolute; inset:0 0 15%; border-radius:15px 15px 7px 7px; background:linear-gradient(115deg,var(--film-silver),var(--film-steel) 5%,var(--film-night) 45%,var(--bs-color-secondary-sky-steel)); box-shadow:inset 0 0 0 1px var(--bs-color-neutral-steel-gray),2px 5px 1px var(--film-night); }
.bs-film__camera { position:absolute; width:4px; height:4px; left:50%; top:1%; border-radius:50%; background:var(--film-steel); box-shadow:0 0 0 1px var(--film-night); }
.bs-film__hinge { position:absolute; inset:84.5% 4% 13%; background:linear-gradient(var(--film-night),var(--bs-color-neutral-slate-gray),var(--film-night)); }
.bs-film__deck { position:absolute; top:86%; left:-4%; width:108%; height:31%; border-radius:2px 2px 13px 13px; background:linear-gradient(100deg,var(--bs-color-neutral-steel-gray),var(--film-silver) 42%,var(--bs-color-neutral-slate-gray)); transform:perspective(900px) rotateX(68deg); transform-origin:50% 0; box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--film-pearl) 50%,transparent); }
.bs-film__keys { position:absolute; inset:6% 10% 49%; display:grid; grid-template-columns:repeat(12,1fr); gap:3px; padding:4px; background:var(--film-steel); border-radius:4px; }
.bs-film__keys>i { border-radius:2px; background:linear-gradient(var(--bs-color-neutral-graphite-text),var(--film-night)); box-shadow:0 1px var(--bs-color-neutral-slate-gray); }
.bs-film__trackpad { position:absolute; inset:57% 38% 7%; border:1px solid var(--bs-color-neutral-slate-gray); border-radius:4px; background:color-mix(in srgb,var(--film-silver) 50%,transparent); }
.bs-film__lip { position:absolute; top:96.4%; left:-3.6%; width:107.2%; height:1.6%; border-radius:0 0 50% 50%; background:linear-gradient(var(--film-silver),var(--bs-color-neutral-slate-gray)); }
.bs-film__contact-shadow { position:absolute; left:-9%; right:-12%; bottom:-4%; height:12%; border-radius:50%; background:radial-gradient(ellipse,color-mix(in srgb,var(--film-night) 90%,transparent),transparent 68%); transform:scaleX(1.2); }
.bs-film__glass { position:absolute; inset:0; pointer-events:none; background:linear-gradient(125deg,color-mix(in srgb,var(--film-pearl) 6%,transparent),transparent 40%); }
[data-j-hardware] { opacity:0; visibility:hidden; }
/* A faithful condensed projection of the catalogue/cart, confirmation and receipt screens. */
.bs-film__app { position:relative; display:grid; grid-template-columns:7% minmax(0,1fr); height:100%; color:var(--bs-text); background:var(--bs-bg); font-size:clamp(9px,1.48cqw,15px); line-height:1.5; text-align:start; }
.bs-film__app h2,.bs-film__app h3,.bs-film__app p { margin:0; }
.bs-film__rail { display:flex; flex-direction:column; align-items:center; gap:7%; padding:18% 15%; background:var(--bs-surface); border-inline-end:1px solid var(--bs-border); }
.bs-film__rail :deep(.ls-logo) { width:100%; height:auto; }
.bs-film__rail :deep(img) { width:100%; height:auto; }
.bs-film__rail>span { display:grid; place-items:center; width:100%; aspect-ratio:1; color:var(--bs-text-muted); border-radius:6px; }
.bs-film__rail>.bs-film__rail-active { color:var(--bs-text-on-accent); background:var(--film-gold); }
.bs-film__rail>i { margin-top:auto; width:55%; aspect-ratio:1; border:1px solid var(--bs-border-strong); border-radius:50%; }
.bs-film__workspace { position:relative; min-width:0; overflow:hidden; }
.bs-film__appbar { height:10%; padding-inline:3.5%; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--bs-border); background:var(--bs-surface); font-size:.8em; }
.bs-film__appbar>span { display:flex; align-items:center; gap:10px; color:var(--bs-text-muted); }
.bs-film__appbar i { width:5px; height:5px; border-radius:50%; background:var(--film-gold); }
.bs-film__pos,.bs-film__records,.bs-film__receipt-view { position:absolute; inset:10% 0 0; padding:3%; }
.bs-film__page-title { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:2.5%; }
.bs-film__page-title h2 { font-size:1.4em; font-weight:700; letter-spacing:-.035em; }
.bs-film__page-title>span { font-size:.72em; color:var(--bs-text-muted); }
.bs-film__pos-columns { display:grid; grid-template-columns:1.13fr 1fr; gap:3%; height:87%; }
.bs-film__catalogue,.bs-film__cart { min-width:0; background:var(--bs-surface); border:1px solid var(--bs-border); border-radius:8px; padding:4%; }
.bs-film__panel-title { display:flex; align-items:center; justify-content:space-between; font-weight:700; font-size:.9em; margin-bottom:5%; }
.bs-film__panel-title>span { color:var(--bs-text-muted); font-size:.75em; font-weight:500; }
.bs-film__search { display:flex; gap:7px; align-items:center; position:relative; color:var(--bs-text-muted); border:1px solid var(--bs-border); border-radius:5px; padding:5% 4%; font-size:.72em; white-space:nowrap; }
.bs-film__search-icon { display:block; position:relative; flex:none; width:10px; height:10px; border:1px solid currentColor; border-radius:50%; margin-inline-end:3px; }.bs-film__search-icon::after { content:""; position:absolute; width:4px; height:1px; background:currentColor; right:-3px; bottom:-2px; transform:rotate(45deg); }
.bs-film__search>strong { position:absolute; inset-inline-start:12%; color:var(--bs-text); opacity:0; visibility:hidden; }
.bs-film__products { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:5%; }
.bs-film__product { position:relative; overflow:hidden; border:1px solid var(--bs-border); border-radius:6px; background:var(--bs-surface); }
.bs-film__product-image { position:relative; height:5.7em; background:radial-gradient(ellipse at 50% 20%,var(--bs-color-brand-pearl-white),var(--bs-color-brand-soft-silver)); overflow:hidden; }
.bs-film__product-copy { display:flex; flex-direction:column; padding:6% 8%; gap:2px; font-size:.76em; }
.bs-film__product-copy>strong { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.bs-film__product-copy>small { display:flex; justify-content:space-between; color:var(--bs-text-muted); font-size:.75em; }
.bs-film__product-copy b { font-weight:500; }
.bs-film__selected { position:absolute; top:5px; inset-inline-end:5px; display:grid; place-items:center; width:1.5em; height:1.5em; border-radius:50%; background:var(--film-gold); color:var(--film-navy); font-size:.8em; font-style:normal; opacity:0; visibility:hidden; }
/* Small product still lifes share the same material as the counter prop. */
.bs-film__object { display:block; position:absolute; width:40%; height:53%; left:28%; bottom:18%; background:linear-gradient(90deg,var(--bs-color-neutral-steel-gray),var(--film-pearl) 35%,var(--film-silver) 70%,var(--bs-color-neutral-steel-gray)); border-radius:4% 4% 32% 32%; box-shadow:5px 8px 8px color-mix(in srgb,var(--film-navy) 20%,transparent); }
.bs-film__object--cup::before,.bs-film__object--bowl::before { content:""; position:absolute; inset:-9% 0 auto; height:21%; border-radius:50%; border:3px solid var(--film-silver); background:var(--bs-color-neutral-slate-gray); }
.bs-film__object--cup>i { position:absolute; right:-33%; top:12%; width:43%; height:66%; border:4px solid var(--film-silver); border-inline-start:0; border-radius:0 50% 50% 0; }
.bs-film__object--bottle { width:26%; height:70%; left:37%; bottom:12%; border-radius:20% 20% 10% 10%; background:linear-gradient(90deg,var(--film-steel),var(--bs-color-secondary-sky-steel) 40%,var(--bs-color-secondary-slate-blue)); }
.bs-film__object--bottle::before { content:""; position:absolute; inset:-8% 20% 95%; border-radius:3px 3px 0 0; background:var(--film-steel); }
.bs-film__object--bowl { width:65%; left:17%; height:35%; border-radius:5% 5% 50% 50%; }
.bs-film__object--service { width:47%; left:25%; height:50%; bottom:20%; border-radius:2px; background:linear-gradient(90deg,var(--bs-color-gold-700),var(--film-gold)); }
.bs-film__object--service::before { content:""; position:absolute; inset:-4% -4% 80%; background:var(--bs-color-gold-300); }
.bs-film__object--service>i { position:absolute; inset:-4% 43% 0; background:var(--film-navy); }
.bs-film__cart { display:flex; flex-direction:column; position:relative; }
.bs-film__empty { font-size:.8em; color:var(--bs-text-muted); padding-block:10%; }
.bs-film__cart-item { position:absolute; inset:15% 6% auto; opacity:0; visibility:hidden; font-size:.82em; }
.bs-film__cart-item>div { display:flex; justify-content:space-between; align-items:center; gap:5px; padding-block:5%; }
.bs-film__cart-item>div>span { display:flex; align-items:center; gap:1.2em; border:1px solid var(--bs-border); padding:3% 5%; border-radius:4px; }
.bs-film__cart-fields { margin-top:auto; padding-top:10%; display:grid; gap:8px; }
.bs-film__field { position:relative; display:grid; gap:4px; font-size:.72em; }
.bs-film__field>span { color:var(--bs-text-muted); }
.bs-film__field>strong { display:flex; justify-content:space-between; border:1px solid var(--bs-border); padding:5%; border-radius:4px; font-weight:500; }
.bs-film__field i { font-style:normal; }
.bs-film__method-menu { position:absolute; inset:100% 0 auto; display:grid; z-index:6; padding:5%; border:1px solid var(--bs-border-strong); border-radius:6px; background:var(--bs-surface-raised); box-shadow:var(--bs-shadow-elevation2); opacity:0; visibility:hidden; }
.bs-film__method-menu>* { padding:3%; font-weight:500; }
.bs-film__method-menu>b { background:color-mix(in srgb,var(--film-gold) 18%,var(--bs-surface)); }
.bs-film__cart-footer { padding-top:8%; display:grid; gap:10px; }
.bs-film__cart-footer>div { display:flex; justify-content:space-between; gap:8px; align-items:center; font-size:.85em; }
.bs-film__total { display:grid; text-align:end; }
.bs-film__total>span { grid-area:1/1; }
[data-j-total-value],[data-j-count] { opacity:0; visibility:hidden; }
.bs-film__checkout { display:flex; align-items:center; justify-content:center; gap:12px; background:var(--film-gold); color:var(--film-navy); border-radius:5px; padding:5%; font-size:.8em; font-weight:700; }
.bs-film__added { position:absolute; left:50%; bottom:8%; transform:translateX(-50%); border:1px solid var(--bs-border); padding:1.5% 3%; border-radius:6px; background:var(--bs-surface-raised); color:var(--bs-text); box-shadow:var(--bs-shadow-elevation2); white-space:nowrap; font-size:.8em; opacity:0; visibility:hidden; }
.bs-film__confirmation { position:absolute; z-index:8; inset:0; display:grid; place-items:center; background:color-mix(in srgb,var(--film-night) 67%,transparent); opacity:0; visibility:hidden; }
.bs-film__dialog { width:64%; padding:5%; border:1px solid var(--bs-border-strong); border-radius:10px; background:var(--bs-surface); box-shadow:0 20px 40px color-mix(in srgb,var(--film-night) 50%,transparent); }
.bs-film__dialog-mark { display:grid; place-items:center; width:2em; height:2em; border:1px solid var(--film-gold); color:var(--bs-text); border-radius:50%; margin-bottom:6%; }
.bs-film__dialog h3 { font-size:1.35em; margin-bottom:4%; }
.bs-film__dialog p { font-size:.9em; color:var(--bs-text-muted); }
.bs-film__dialog>div { display:flex; gap:8px; justify-content:flex-end; margin-top:9%; font-size:.85em; }
.bs-film__dialog>div>* { padding:4% 8%; border:1px solid var(--bs-border); border-radius:5px; }
.bs-film__dialog b { background:var(--film-gold); color:var(--film-navy); }
.bs-film__receipt-view,.bs-film__records { opacity:0; visibility:hidden; background:var(--bs-bg); }
.bs-film__receipt-tools { display:flex; align-items:center; gap:10px; padding-block:1% 3%; font-size:.8em; }
.bs-film__receipt-tools>span { display:flex; align-items:center; gap:5px; border:1px solid var(--bs-border-strong); padding:1% 3%; border-radius:5px; }
.bs-film__receipt-tools>small { margin-inline-start:auto; }
.bs-film__digital-paper { display:flex; flex-direction:column; gap:10px; width:55%; margin:auto; padding:5%; color:var(--bs-color-neutral-graphite-text); background:var(--film-pearl); border:1px solid var(--bs-color-brand-cloud-gray); text-align:center; box-shadow:var(--bs-shadow-elevation1); font-size:.8em; }
.bs-film__digital-paper>strong { font-size:1.4em; }.bs-film__digital-paper>div { display:flex; justify-content:space-between; gap:10px; padding-block:5%; border-top:1px dashed var(--bs-color-neutral-steel-gray); font-size:.8em; }
.bs-film__paid { color:var(--bs-success,var(--bs-color-semantic-success)); font-size:.75em; }
.bs-film__metrics { display:grid; grid-template-columns:1fr .6fr 1fr; gap:2%; margin-block:5%; }
.bs-film__metrics>div { display:flex; flex-direction:column; gap:8px; padding:10%; background:var(--bs-surface); border:1px solid var(--bs-border); border-radius:8px; }
.bs-film__metrics span { color:var(--bs-text-muted); font-size:.75em; }.bs-film__metrics strong { font-size:1.3em; white-space:nowrap; font-weight:600; }
.bs-film__ledger-row { display:flex; gap:14px; align-items:center; padding:4% 3%; border-block:1px solid var(--bs-border); font-size:.8em; }
.bs-film__ledger-row>div { display:grid; gap:3px; }.bs-film__ledger-row>div>span { color:var(--bs-text-muted); }.bs-film__ledger-row>b { margin-inline-start:auto; }
.bs-film__stock { display:flex; gap:14px; align-items:center; margin-top:5%; padding:4%; border:1px solid var(--bs-border); border-radius:8px; background:var(--bs-surface); }
.bs-film__stock-symbol { display:grid; place-items:center; width:3em; height:3em; background:color-mix(in srgb,var(--film-gold) 15%,var(--bs-surface)); border-radius:6px; color:var(--bs-text); }
.bs-film__stock>div { display:grid; gap:4px; font-size:.8em; }.bs-film__stock>div>span { color:var(--bs-text-muted); }.bs-film__stock>b { margin-inline-start:auto; font-size:1.7em; }.bs-film__stock>b>span { color:var(--bs-text-muted); font-weight:400; }
.bs-film__cursor { position:absolute; z-index:10; width:2.5%; height:auto; inset-inline-start:28%; top:42%; fill:var(--film-pearl); stroke:var(--film-navy); stroke-width:1.5; filter:drop-shadow(0 2px 2px color-mix(in srgb,var(--film-night) 40%,transparent)); opacity:0; visibility:hidden; }
.bs-film__click { position:absolute; z-index:9; width:4%; aspect-ratio:1; border:2px solid var(--film-gold); border-radius:50%; inset-inline-start:28%; top:42%; transform:translate(-35%,-35%); opacity:0; }
.bs-film__paper-shot { position:absolute; z-index:7; left:62%; top:45%; width:clamp(240px,24vw,360px); transform:translate(-50%,-50%); opacity:0; visibility:hidden; }
.bs-film__paper { position:relative; display:flex; flex-direction:column; gap:10px; padding:34px 28px 38px; color:var(--bs-color-neutral-graphite-text); background:linear-gradient(105deg,var(--bs-color-brand-soft-silver),var(--film-pearl) 10% 85%,var(--bs-color-brand-soft-silver)); font-size:11px; text-align:center; box-shadow:8px 25px 45px color-mix(in srgb,var(--film-night) 55%,transparent); clip-path:polygon(0 0,100% 0,100% 98%,98% 100%,96% 98%,94% 100%,92% 98%,90% 100%,88% 98%,86% 100%,84% 98%,82% 100%,80% 98%,78% 100%,76% 98%,74% 100%,72% 98%,70% 100%,68% 98%,66% 100%,64% 98%,62% 100%,60% 98%,58% 100%,56% 98%,54% 100%,52% 98%,50% 100%,48% 98%,46% 100%,44% 98%,42% 100%,40% 98%,38% 100%,36% 98%,34% 100%,32% 98%,30% 100%,28% 98%,26% 100%,24% 98%,22% 100%,20% 98%,18% 100%,16% 98%,14% 100%,12% 98%,10% 100%,8% 98%,6% 100%,4% 98%,2% 100%,0 98%); }
.bs-film__paper-brand { font-size:23px; font-weight:700; letter-spacing:-.04em; }
.bs-film__paper dl { border-block:1px dashed var(--bs-color-neutral-steel-gray); padding-block:14px; margin:8px 0; display:grid; gap:6px; }
.bs-film__paper dl>div { display:flex; justify-content:space-between; gap:8px; text-align:start; }.bs-film__paper dd { margin:0; text-align:end; }
.bs-film__paper-line,.bs-film__paper-total { display:flex; justify-content:space-between; align-items:center; gap:8px; text-align:start; padding-block:10px; }.bs-film__paper-line { border-bottom:1px dashed var(--bs-color-neutral-steel-gray); }.bs-film__paper-total strong { font-size:17px; }
.bs-film__paper-paid { color:var(--bs-color-semantic-success); font-size:11px; }.bs-film__paper-fold { position:absolute; left:0; right:0; top:64%; height:1px; box-shadow:0 1px 2px var(--bs-color-neutral-steel-gray); opacity:.35; }
.bs-film__paper-shot>p { color:var(--film-silver); text-align:center; font-size:.65rem; line-height:1.8; margin:26px -20px 0; }


.bs-film__record-thread { position:absolute; z-index:4; left:50%; right:14%; top:54%; display:flex; align-items:center; opacity:0; visibility:hidden; }
.bs-film__record-thread>span { height:1px; flex:1; background:var(--film-gold); }.bs-film__record-thread>i { width:7px; height:7px; background:var(--film-gold); border-radius:50%; }
.bs-film__captions { position:absolute; z-index:9; left:5.5%; top:17%; width:28%; pointer-events:none; }
.bs-film__caption { position:absolute; inset:0 auto auto 0; width:100%; opacity:0; visibility:hidden; }
.bs-film__caption>p { color:var(--bs-color-brand-highlight-gold); font-size:.75rem; margin:0 0 22px; }
.bs-film__caption>h2 { margin:0 0 22px; font-size:clamp(2.1rem,3.5vw,4.2rem); line-height:1.12; letter-spacing:-.055em; font-weight:500; text-wrap:balance; }
.bs-film__caption>span { display:block; max-width:34ch; color:var(--film-silver); font-size:clamp(.85rem,1.05vw,1rem); line-height:1.85; }
.bs-film__controls { position:absolute; z-index:12; inset:auto 5.5% 0; height:65px; display:flex; align-items:center; justify-content:space-between; gap:20px; color:var(--film-silver); font-size:.65rem; }
.bs-film__controls>a { display:flex; gap:8px; align-items:center; color:var(--film-pearl); text-decoration:underline; text-underline-offset:4px; }
.bs-film__scroll { display:flex; align-items:center; gap:10px; }.bs-film__scroll>i { width:15px; height:23px; border:1px solid var(--bs-color-neutral-steel-gray); border-radius:12px; position:relative; }.bs-film__scroll>i::after { content:""; position:absolute; width:2px; height:5px; background:var(--film-gold); left:5px; top:4px; }
.bs-film__progress { position:absolute; inset:0 0 auto; height:1px; background:color-mix(in srgb,var(--film-silver) 20%,transparent); }.bs-film__progress>span { display:block; width:100%; height:100%; background:var(--film-gold); transform:scaleX(0); transform-origin:left; }
.bs-film__transcript { list-style:none; margin:0; padding:60px max(6%,24px); }
.bs-film__transcript>li { display:flex; justify-content:space-between; align-items:center; gap:40px; max-width:1100px; padding-block:45px; margin:auto; border-bottom:1px solid var(--film-steel); }.bs-film__transcript>li>div:first-child { max-width:550px; }.bs-film__transcript p { color:var(--bs-color-brand-highlight-gold); font-size:.75rem; }.bs-film__transcript h2 { font-weight:500; font-size:clamp(1.7rem,3vw,2.75rem); letter-spacing:-.04em; }.bs-film__transcript span { color:var(--film-silver); line-height:1.85; }
.bs-film__still { min-width:30%; max-width:360px; display:grid; gap:12px; padding:24px; border-inline-start:1px solid var(--film-gold); }.bs-film__still>strong { font-size:1.25rem; font-weight:500; }.bs-film__still small { font-size:.8rem; color:var(--film-silver); }.bs-film__still--paper { background:var(--film-pearl); color:var(--film-navy); border:0; }.bs-film__still--paper span,.bs-film__still--paper small { color:var(--bs-color-neutral-slate-gray); }
.bs-film__features { max-width:1300px; margin:auto; padding:85px max(5.5%,24px) 25px; scroll-margin-top:6rem; }
.bs-film__features>header { display:grid; grid-template-columns:1fr 1fr; gap:50px; align-items:start; margin-bottom:48px; }.bs-film__features>header>h2 { max-width:18ch; font-size:clamp(2rem,3.4vw,3.6rem); letter-spacing:-.045em; line-height:1.2; font-weight:500; margin:0; }.bs-film__features>header>p { max-width:43ch; font-size:.95rem; color:var(--film-silver); line-height:1.9; margin:0; }
.bs-film__feature-list { display:grid; grid-template-columns:1fr 1fr; column-gap:50px; }.bs-film__feature-list>article { display:flex; gap:20px; align-items:start; border-top:1px solid var(--film-steel); padding-block:28px; }.bs-film__feature-list>article>:first-child { flex:none; color:var(--bs-color-brand-highlight-gold); margin-top:4px; }.bs-film__feature-list h3 { font-size:1.05rem; line-height:1.6; font-weight:600; margin:0 0 8px; }.bs-film__feature-list p { font-size:.85rem; line-height:1.9; color:var(--film-silver); margin:0; }
.bs-film__outro { display:flex; flex-direction:column; align-items:center; text-align:center; gap:24px; padding:100px 24px 120px; background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--film-gold) 9%,transparent),transparent 65%); }.bs-film__outro>p { color:var(--bs-color-brand-highlight-gold); font-size:.9rem; margin:0; }.bs-film__outro>h2 { max-width:15ch; font-size:clamp(2.75rem,6.5vw,7rem); font-weight:500; letter-spacing:-.06em; line-height:1.08; margin:0; text-wrap:balance; }.bs-film__outro>span { color:var(--film-silver); line-height:1.8; }.bs-film__outro>a { margin-top:12px; }


/* The readable transcript remains in the accessibility tree during the animated presentation. */
.bs-film[data-j-enhanced] .bs-film__transcript { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
:dir(rtl) .bs-film__intro { inset-inline-start:auto; left:5.5%; }
:dir(rtl) .bs-film__intro h1,:dir(rtl) .bs-film__caption>h2,:dir(rtl) .bs-film__outro>h2 { letter-spacing:normal; line-height:1.4; }
:dir(rtl) .bs-film__progress>span { transform-origin:right; }
@media (min-width:960px) and (max-height:760px) { .bs-film__stage { min-height:0; }.bs-film__intro { top:9%; }.bs-film__signature { margin-bottom:14px; }.bs-film__intro h1 { font-size:clamp(2.7rem,4.6vw,4.5rem); }.bs-film__description { margin-block:18px; font-size:.85rem; }.bs-film__captions { top:12%; }.bs-film__caption>h2 { font-size:2.7rem; }.bs-film__paper { padding-block:22px; gap:7px; } }
@media (max-width:959px) {
  .bs-film__stage { height:auto; min-height:calc(100svh - var(--bs-landing-header-height,4.5rem)); padding:46px 24px 75px; perspective:1200px; }
  .bs-film__intro { position:relative; inset:auto; width:100%; max-width:640px; margin-inline:auto; }
  .bs-film__signature { font-size:.85rem; margin-bottom:18px; }.bs-film__intro h1 { max-width:14ch; font-size:clamp(2.7rem,7.3vw,4.5rem); line-height:1.1; }.bs-film__description { max-width:45ch; font-size:.9rem; margin-block:20px; }.bs-film__actions { gap:18px; }.bs-film__note { font-size:.65rem; }
  .bs-film__device { position:relative; width:min(96%,660px); margin:42px auto 18px; left:auto; top:auto; transform:none; aspect-ratio:1.35; }
  .bs-film__app { font-size:clamp(10px,2.05cqw,13px); grid-template-columns:1fr; }.bs-film__rail { display:none; }.bs-film__page-title h2 { font-size:1.2em; }.bs-film__page-title>span { font-size:.65em; }.bs-film__catalogue,.bs-film__cart { padding:5%; }.bs-film__product-image { height:5.4em; }.bs-film__products { gap:5px; }.bs-film__product-copy { font-size:.7em; }.bs-film__product-copy>small { display:none; }.bs-film__product-copy>span { font-size:.9em; }.bs-film__cart-fields { gap:6px; }.bs-film__field { font-size:.8em; }.bs-film__panel-title { font-size:.85em; }.bs-film__search { font-size:.65em; }.bs-film__appbar { font-size:.8em; }.bs-film__checkout { font-size:.8em; gap:5px; }.bs-film__cart-footer { gap:7px; }.bs-film__cart-item { font-size:.75em; }.bs-film__cart-item>div>span { gap:.5em; }.bs-film__cart-item>div>strong { font-size:.8em; }
  .bs-film__screen { inset:2.2% 1% 17.2%; }.bs-film__glass { opacity:.5; }
  .bs-film__controls { inset:auto 24px 0; height:55px; gap:12px; }.bs-film__disclaimer { max-width:53%; font-size:.58rem; }.bs-film__scroll { display:none; }.bs-film__controls>a { font-size:.65rem; margin-inline-start:auto; }
  .bs-film__captions { left:24px; top:6%; width:calc(100% - 48px); }.bs-film__caption>p { margin-bottom:10px; font-size:.65rem; }.bs-film__caption>h2 { max-width:20ch; font-size:clamp(1.9rem,4.7vw,3rem); margin-bottom:14px; }.bs-film__caption>span { max-width:48ch; font-size:.85rem; line-height:1.7; }
  .bs-film__order { top:36%; right:24px; width:calc(100% - 48px); text-align:center; }.bs-film__order>span { font-size:.6rem; }.bs-film__order>p { font-size:1.1rem; margin-top:8px; }
  .bs-film__room { background:radial-gradient(ellipse at 50% 20%,var(--bs-color-brand-building-navy),var(--film-night) 70%); }.bs-film__window,.bs-film__window-light,.bs-film__wall,.bs-film__bag,.bs-film__counter-cup { display:none; }.bs-film__counter { inset:78% -20% -20%; }
  .bs-film__paper-shot { left:50%; top:63%; width:220px; }.bs-film__paper { padding:22px 22px 28px; font-size:9px; gap:6px; }.bs-film__paper-brand { font-size:19px; }.bs-film__paper dl { padding-block:9px; margin:3px 0; gap:4px; }.bs-film__paper-line,.bs-film__paper-total { padding-block:6px; }.bs-film__paper-total strong { font-size:14px; }.bs-film__paper-shot>p { font-size:.57rem; margin-top:15px; }
  .bs-film__dialog { width:80%; padding:5%; }.bs-film__dialog h3 { font-size:1.15em; }.bs-film__dialog p { font-size:.9em; }.bs-film__dialog-mark { display:none; }.bs-film__metrics { gap:5px; }.bs-film__metrics>div { padding:10% 6%; }.bs-film__metrics strong { font-size:1em; }.bs-film__metrics span { font-size:.65em; }.bs-film__ledger-row { gap:8px; font-size:.65em; }.bs-film__stock { gap:8px; }.bs-film__stock>div { font-size:.7em; }.bs-film__stock>b { font-size:1.3em; }.bs-film__digital-paper { width:70%; font-size:.8em; gap:8px; }
  .bs-film__features { padding:55px 24px 15px; }.bs-film__features>header { grid-template-columns:1fr; gap:20px; margin-bottom:30px; }.bs-film__feature-list { grid-template-columns:1fr; }.bs-film__feature-list>article { padding-block:22px; }.bs-film__features>header>h2 { max-width:none; }
  .bs-film__transcript { padding:15px 24px 40px; }.bs-film__transcript>li { padding-block:30px; flex-direction:column; align-items:stretch; gap:15px; }.bs-film__transcript>li>div:first-child { max-width:none; }.bs-film__still { width:100%; max-width:none; padding:15px; }.bs-film__outro { padding:65px 24px 80px; }.bs-film__outro>h2 { font-size:clamp(2.8rem,8vw,5rem); }
  .bs-film[data-j-enhanced] .bs-film__stage { height:calc(100svh - var(--bs-landing-header-height,4.5rem)); height:calc(100dvh - var(--bs-landing-header-height,4.5rem)); min-height:0; padding:0; }
  .bs-film[data-j-enhanced] .bs-film__intro { position:absolute; left:24px; top:6%; width:calc(100% - 48px); max-width:none; }
  .bs-film[data-j-enhanced] .bs-film__device { position:absolute; left:50%; top:72%; width:min(90%,650px); margin:0; transform:translate(-50%,-50%); }
  .bs-film[data-j-enhanced] .bs-film__intro h1 { font-size:clamp(2.5rem,6vw,4rem); }
  .bs-film[data-j-enhanced] .bs-film__description { max-width:48ch; font-size:.82rem; margin-block:15px; }
  :dir(rtl) .bs-film__intro { inset:auto; left:auto; }:dir(rtl) .bs-film[data-j-enhanced] .bs-film__intro { left:24px; top:6%; }
}
@media (max-width:480px) {
  .bs-film[data-j-enhanced] .bs-film__intro h1 { max-width:none; font-size:clamp(2.15rem,9.5vw,2.8rem); }
  .bs-film[data-j-enhanced] .bs-film__signature { margin-bottom:12px; }
  .bs-film[data-j-enhanced] .bs-film__description { font-size:.78rem; line-height:1.65; margin-block:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .bs-film[data-j-enhanced] .bs-film__note { margin-top:9px; }
  .bs-film[data-j-enhanced] .bs-film__actions { gap:14px; }
  .bs-film[data-j-enhanced] .bs-film__actions .ls-btn { font-size:.8rem; padding-inline:16px; }
 .bs-film__products { grid-template-columns:1fr; }.bs-film__product:not(:first-child) { display:none; }.bs-film__product-image { height:5.6em; }.bs-film__product-copy { padding:6%; font-size:.85em; }.bs-film__search>span { overflow:hidden; text-overflow:ellipsis; }.bs-film__pos-columns { grid-template-columns:.9fr 1.1fr; gap:3%; }.bs-film__device { aspect-ratio:1.16; }.bs-film__app { font-size:10px; }.bs-film__pos { padding:4% 3%; }.bs-film__appbar>span { gap:5px; }.bs-film__receipt-tools { gap:5px; }.bs-film__receipt-tools>small { font-size:.7em; }.bs-film__digital-paper { width:85%; }.bs-film__caption>span { font-size:.8rem; }.bs-film__metrics { grid-template-columns:1fr 1fr; }.bs-film__metrics>div:nth-child(2) { display:none; }.bs-film__ledger-row>.bs-film__paid { display:none; } }
@media (prefers-reduced-motion:reduce) { .bs-film__stage { max-height:none; } .bs-film * { animation:none!important; transition:none!important; }.bs-film__stage { height:auto; min-height:calc(100svh - var(--bs-landing-header-height,4.5rem)); padding:65px 24px 25px; }.bs-film__intro { position:relative; inset:auto; width:min(100%,740px); margin:auto; }.bs-film__intro h1 { max-width:15ch; }.bs-film__device { position:relative; inset:auto; width:min(100%,850px); margin:50px auto 10px; transform:none; }.bs-film__controls { position:relative; inset:auto; margin-top:40px; }.bs-film__scroll { display:none; }:dir(rtl) .bs-film__intro { inset:auto; } }
</style>
