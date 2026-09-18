import AuthIcon from "./AuthIcon.js";

export default {
  name: "FloatingField",
  components: { AuthIcon },
  props: {
    id: { type: String, required: true },
    label: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, default: "text" },
    value: { type: String, default: "" },
    placeholder: { type: String, default: " " },
    autocomplete: { type: String, default: "" },
    inputmode: { type: String, default: "" },
    optional: { type: Boolean, default: false },
    passwordToggle: { type: Boolean, default: false },
    actionLabel: { type: String, default: "" }
  },
  emits: ["action"],
  data() {
    return {
      visible: false
    };
  },
  computed: {
    inputType() {
      if (!this.passwordToggle) return this.type;
      return this.visible ? "text" : "password";
    },
    hasAction() {
      return Boolean(this.actionLabel);
    }
  },
  template: `
    <div v-if="hasAction || passwordToggle" class="field floating-field" :class="{ 'has-field-action': hasAction }">
      <span class="control" :class="{ 'password-control': passwordToggle }">
        <input
          :id="id"
          :type="inputType"
          :name="name"
          :autocomplete="autocomplete || null"
          :inputmode="inputmode || null"
          :value="value"
          :placeholder="placeholder"
        />
        <label class="field-label" :for="id">
          {{ label }}
          <span v-if="optional" class="optional-tag">Optional</span>
        </label>
        <button
          v-if="passwordToggle"
          class="field-icon-button"
          type="button"
          :aria-label="visible ? 'Hide password' : 'Show password'"
          :aria-pressed="visible ? 'true' : 'false'"
          @click="visible = !visible"
        >
          <AuthIcon :name="visible ? 'eyeOff' : 'eye'" :size="20" />
        </button>
      </span>
      <button v-if="hasAction" class="quiet-link field-action" type="button" @click="$emit('action')">
        {{ actionLabel }}
      </button>
    </div>
    <label v-else class="field floating-field">
      <span class="control">
        <input
          :id="id"
          :type="type"
          :name="name"
          :autocomplete="autocomplete || null"
          :inputmode="inputmode || null"
          :value="value"
          :placeholder="placeholder"
        />
        <span class="field-label">
          {{ label }}
          <span v-if="optional" class="optional-tag">Optional</span>
        </span>
      </span>
    </label>
  `
};
