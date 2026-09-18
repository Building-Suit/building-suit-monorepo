export default {
  name: "OtpRow",
  props: {
    digits: { type: Array, required: true },
    label: { type: String, required: true },
    compact: { type: Boolean, default: false }
  },
  template: `
    <div class="otp-row" :class="{ 'compact-otp': compact }" :aria-label="label">
      <input
        v-for="(digit, index) in digits"
        :key="index"
        inputmode="numeric"
        maxlength="1"
        :value="digit"
        :aria-label="'Digit ' + (index + 1)"
      />
    </div>
  `
};
