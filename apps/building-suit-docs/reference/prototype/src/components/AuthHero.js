export default {
  name: "AuthHero",
  props: {
    variant: { type: String, required: true }
  },
  template: `
    <header class="auth-hero" :class="'auth-hero-' + variant">
      <div class="hero-map" aria-hidden="true"></div>
      <slot></slot>
    </header>
  `
};
