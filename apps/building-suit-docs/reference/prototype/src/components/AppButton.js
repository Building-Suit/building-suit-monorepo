export default {
  name: "AppButton",
  props: {
    variant: { type: String, default: "primary" },
    disabled: { type: Boolean, default: false }
  },
  emits: ["click"],
  template: `
    <button
      class="button"
      :class="variant + '-button'"
      type="button"
      :disabled="disabled"
      @click="$emit('click')"
    >
      <slot></slot>
    </button>
  `
};
