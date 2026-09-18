export default {
  name: "StepTrack",
  props: {
    steps: { type: Array, required: true }
  },
  template: `
    <div class="step-track" aria-label="Verification progress">
      <span
        v-for="(step, index) in steps"
        :key="index"
        class="step"
        :class="step ? 'is-' + step : null"
      ></span>
    </div>
  `
};
