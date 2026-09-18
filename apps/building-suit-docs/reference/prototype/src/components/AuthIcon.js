import { HugeiconsIcon } from "@hugeicons/vue";
import EyeIcon from "@hugeicons/core-free-icons/EyeIcon";
import EyeOffIcon from "@hugeicons/core-free-icons/EyeOffIcon";
import FingerPrintIcon from "@hugeicons/core-free-icons/FingerPrintIcon";
import LanguageCircleIcon from "@hugeicons/core-free-icons/LanguageCircleIcon";
import MoonIcon from "@hugeicons/core-free-icons/MoonIcon";
import Sun01Icon from "@hugeicons/core-free-icons/Sun01Icon";

const icons = {
  eye: EyeIcon,
  eyeOff: EyeOffIcon,
  fingerprint: FingerPrintIcon,
  language: LanguageCircleIcon,
  moon: MoonIcon,
  sun: Sun01Icon
};

export default {
  name: "AuthIcon",
  components: { HugeiconsIcon },
  props: {
    name: { type: String, required: true },
    size: { type: Number, default: 20 }
  },
  computed: {
    icon() {
      return icons[this.name];
    }
  },
  template: `
    <HugeiconsIcon
      class="auth-icon"
      :icon="icon"
      :size="size"
      color="currentColor"
      :stroke-width="2"
      :absolute-stroke-width="true"
      aria-hidden="true"
    />
  `
};
