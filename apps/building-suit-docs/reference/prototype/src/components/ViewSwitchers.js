import AuthIcon from "./AuthIcon.js";

export default {
  name: "ViewSwitchers",
  components: { AuthIcon },
  props: {
    locale: { type: String, required: true },
    theme: { type: String, required: true }
  },
  emits: ["toggle-locale", "toggle-theme"],
  computed: {
    languageLabel() {
      return this.locale === "ar" ? "English" : "العربية";
    },
    themeLabel() {
      return this.theme === "dark" ? "Light" : "Dark";
    },
    themeIcon() {
      return this.theme === "dark" ? "sun" : "moon";
    }
  },
  template: `
    <div class="auth-switchers" aria-label="Authentication view settings">
      <button type="button" aria-label="Switch language" @click="$emit('toggle-locale')">
        <AuthIcon name="language" :size="18" />
        <span>{{ languageLabel }}</span>
      </button>
      <button type="button" aria-label="Switch color mode" @click="$emit('toggle-theme')">
        <AuthIcon :name="themeIcon" :size="18" />
        <span>{{ themeLabel }}</span>
      </button>
    </div>
  `
};
