import AuthHero from "./AuthHero.js";

export default {
  name: "AuthScreen",
  components: { AuthHero },
  props: {
    id: { type: String, required: true },
    titleId: { type: String, required: true },
    active: { type: Boolean, required: true },
    variant: { type: String, required: true },
    compact: { type: Boolean, default: false }
  },
  template: `
    <section class="auth-screen" :class="{ 'is-active': active }" :id="id" :aria-labelledby="titleId">
      <AuthHero :variant="variant">
        <slot name="hero"></slot>
      </AuthHero>
      <div class="auth-panel">
        <form class="auth-form" :class="{ 'compact-form': compact }" action="#" method="post" @submit.prevent>
          <slot name="form"></slot>
        </form>
      </div>
    </section>
  `
};
