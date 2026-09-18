export default {
  name: "BrandMark",
  props: {
    label: { type: String, default: "Building Suit" }
  },
  emits: ["navigate"],
  template: `
    <a class="brand-mark" href="#login" :aria-label="label" @click.prevent="$emit('navigate', 'login')">
      <img src="/assets/logos/building-suit-logo-light.png" alt="" aria-hidden="true" />
      <span>uilding Suit</span>
    </a>
  `
};
