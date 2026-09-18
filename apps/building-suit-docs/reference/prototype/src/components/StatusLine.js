export default {
  name: "StatusLine",
  props: {
    kind: { type: String, default: "neutral" }
  },
  template: `
    <div class="status-line" :class="'status-' + kind">
      <span class="status-dot"></span>
      <span><slot></slot></span>
    </div>
  `
};
