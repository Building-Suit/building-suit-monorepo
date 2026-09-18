import { navItems, screenIds } from "./data/screens.js";
import AppButton from "./components/AppButton.js";
import AuthIcon from "./components/AuthIcon.js";
import AuthScreen from "./components/AuthScreen.js";
import BrandMark from "./components/BrandMark.js";
import FloatingField from "./components/FloatingField.js";
import GoogleMark from "./components/GoogleMark.js";
import IdentityCard from "./components/IdentityCard.js";
import OtpRow from "./components/OtpRow.js";
import StatusLine from "./components/StatusLine.js";
import StepTrack from "./components/StepTrack.js";
import ViewSwitchers from "./components/ViewSwitchers.js";

const storage = {
  get(key, fallback) {
    try {
      return window.localStorage.getItem(key) || fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Prototype preference only.
    }
  }
};

export default {
  name: "App",
  components: {
    AppButton,
    AuthIcon,
    AuthScreen,
    BrandMark,
    FloatingField,
    GoogleMark,
    IdentityCard,
    OtpRow,
    StatusLine,
    StepTrack,
    ViewSwitchers
  },
  data() {
    return {
      navItems,
      activeId: "login",
      locale: "en",
      theme: "light"
    };
  },
  mounted() {
    this.locale = storage.get("bs-prototype-locale", "en");
    this.theme = storage.get("bs-prototype-theme", "light");
    this.syncFromHash();
    this.applyViewState();
    window.addEventListener("hashchange", this.syncFromHash);
  },
  beforeUnmount() {
    window.removeEventListener("hashchange", this.syncFromHash);
  },
  methods: {
    syncFromHash() {
      const hash = window.location.hash.replace("#", "");
      if (screenIds.includes(hash)) this.activeId = hash;
    },
    navigate(id) {
      if (!screenIds.includes(id)) return;
      this.activeId = id;
      window.history.pushState(null, "", `#${id}`);
    },
    toggleLocale() {
      this.locale = this.locale === "ar" ? "en" : "ar";
      this.applyViewState();
    },
    toggleTheme() {
      this.theme = this.theme === "dark" ? "light" : "dark";
      this.applyViewState();
    },
    applyViewState() {
      document.documentElement.lang = this.locale === "ar" ? "ar" : "en";
      document.documentElement.dir = this.locale === "ar" ? "rtl" : "ltr";
      document.documentElement.dataset.theme = this.theme;
      storage.set("bs-prototype-locale", this.locale);
      storage.set("bs-prototype-theme", this.theme);
    }
  },
  template: `
    <main class="prototype-shell">
      <aside class="prototype-nav" aria-label="Auth prototype navigation">
        <p class="nav-kicker">Building Suit</p>
        <h1>Auth screens</h1>
        <p class="nav-copy">Vue prototype using shared Material 3-style auth components.</p>
        <nav class="screen-nav" aria-label="Screens">
          <a
            v-for="item in navItems"
            :key="item.id"
            class="nav-link"
            :class="{ 'is-active': activeId === item.id }"
            :href="'#' + item.id"
            @click.prevent="navigate(item.id)"
          >
            {{ item.label }}
          </a>
        </nav>
      </aside>

      <section class="device-stage" aria-label="Mobile preview">
        <div class="phone-shell">
          <AuthScreen id="login" title-id="login-title" variant="login" :active="activeId === 'login'">
            <template #hero>
              <BrandMark label="Building Suit login" @navigate="navigate" />
              <ViewSwitchers
                :locale="locale"
                :theme="theme"
                @toggle-locale="toggleLocale"
                @toggle-theme="toggleTheme"
              />
              <div class="hero-copy">
                <h2 id="login-title">Welcome back</h2>
                <p>Your building essentials, clear from the first tap.</p>
              </div>
            </template>
            <template #form>
              <StatusLine kind="info">Session expired. Sign in again to continue.</StatusLine>
              <FloatingField
                id="login-identifier"
                label="Email or Egyptian phone"
                name="identifier"
                autocomplete="username"
                value="+20 10 1234 5678"
                placeholder="name@example.com or +20 10 1234 5678"
              />
              <FloatingField
                id="login-password"
                label="Password"
                name="password"
                type="password"
                autocomplete="current-password"
                placeholder="Enter password"
                password-toggle
                action-label="forgot password?"
                @action="navigate('reset-request')"
              />
              <div class="action-row">
                <AppButton @click="navigate('verify-phone')">Login</AppButton>
                <button class="icon-button" type="button" aria-label="Fingerprint sign in">
                  <AuthIcon name="fingerprint" :size="22" />
                </button>
              </div>
              <div class="divider"><span>or continue with</span></div>
              <AppButton variant="secondary" @click="navigate('one-last-step')">
                <GoogleMark />
                <span>Google</span>
              </AppButton>
              <p class="switch-line">
                New to Building Suit?
                <button type="button" @click="navigate('register')">Create account</button>
              </p>
            </template>
          </AuthScreen>

          <AuthScreen id="register" title-id="register-title" variant="register" :active="activeId === 'register'" compact>
            <template #hero>
              <BrandMark label="Back to login" @navigate="navigate" />
              <ViewSwitchers
                :locale="locale"
                :theme="theme"
                @toggle-locale="toggleLocale"
                @toggle-theme="toggleTheme"
              />
              <div class="hero-copy">
                <p class="eyebrow">Create global account</p>
                <h2 id="register-title">Join your building network</h2>
                <p>Phone is required for WhatsApp verification. Email can be added now or later.</p>
              </div>
            </template>
            <template #form>
              <FloatingField id="full-name" label="Full name" name="full-name" autocomplete="name" value="Tareq Hassan" placeholder="Tareq Hassan" />
              <FloatingField id="register-phone" label="Egyptian phone" name="phone" type="tel" autocomplete="tel" value="+20 10 1234 5678" placeholder="+20 10 1234 5678" />
              <FloatingField id="register-email" label="Email" name="email" type="email" autocomplete="email" value="name@example.com" placeholder="name@example.com" optional />
              <div class="field-grid">
                <FloatingField id="register-password" label="Password" name="new-password" type="password" autocomplete="new-password" placeholder="Minimum policy" />
                <FloatingField id="confirm-password" label="Confirm" name="confirm-password" type="password" autocomplete="new-password" placeholder="Repeat password" />
              </div>
              <label class="check-row">
                <input type="checkbox" name="terms" checked />
                <span>I accept the terms and privacy notices.</span>
              </label>
              <AppButton @click="navigate('verify-phone')">Create account</AppButton>
              <div class="divider"><span>or register with</span></div>
              <AppButton variant="secondary" @click="navigate('one-last-step')">
                <GoogleMark />
                <span>Google</span>
              </AppButton>
              <p class="switch-line">
                Already registered?
                <button type="button" @click="navigate('login')">Login</button>
              </p>
            </template>
          </AuthScreen>

          <AuthScreen id="verify-phone" title-id="phone-title" variant="otp" :active="activeId === 'verify-phone'">
            <template #hero>
              <BrandMark @navigate="navigate" />
              <ViewSwitchers
                :locale="locale"
                :theme="theme"
                @toggle-locale="toggleLocale"
                @toggle-theme="toggleTheme"
              />
              <div class="hero-copy">
                <p class="eyebrow">WhatsApp verification</p>
                <h2 id="phone-title">Check your phone</h2>
                <p>Enter the 6 digit code sent to +20 10 1234 5678 via WhatsApp.</p>
              </div>
            </template>
            <template #form>
              <StepTrack :steps="['active', '']" />
              <OtpRow label="WhatsApp OTP" :digits="['8', '4', '1', '9', '2', '6']" />
              <StatusLine kind="success">Resend available in 00:42.</StatusLine>
              <AppButton @click="navigate('verify-email')">Verify phone</AppButton>
              <AppButton variant="ghost" disabled>Resend WhatsApp code</AppButton>
              <p class="switch-line">
                Wrong number?
                <button type="button" @click="navigate('register')">Edit registration</button>
              </p>
            </template>
          </AuthScreen>

          <AuthScreen id="verify-email" title-id="email-title" variant="email" :active="activeId === 'verify-email'">
            <template #hero>
              <BrandMark @navigate="navigate" />
              <ViewSwitchers
                :locale="locale"
                :theme="theme"
                @toggle-locale="toggleLocale"
                @toggle-theme="toggleTheme"
              />
              <div class="hero-copy">
                <p class="eyebrow">Optional email supplied</p>
                <h2 id="email-title">Verify email</h2>
                <p>Enter the 6 digit code sent to name@example.com to complete account access.</p>
              </div>
            </template>
            <template #form>
              <StepTrack :steps="['complete', 'active']" />
              <OtpRow label="Email OTP" :digits="['4', '8', '2', '1', '0', '9']" />
              <StatusLine kind="error">Code expired. Request a fresh email code.</StatusLine>
              <AppButton>Verify email</AppButton>
              <AppButton variant="ghost">Resend email code</AppButton>
              <p class="switch-line">
                Phone verified.
                <button type="button" @click="navigate('login')">Return to login</button>
              </p>
            </template>
          </AuthScreen>

          <AuthScreen id="reset-request" title-id="reset-title" variant="reset" :active="activeId === 'reset-request'">
            <template #hero>
              <BrandMark label="Back to login" @navigate="navigate" />
              <ViewSwitchers
                :locale="locale"
                :theme="theme"
                @toggle-locale="toggleLocale"
                @toggle-theme="toggleTheme"
              />
              <div class="hero-copy">
                <p class="eyebrow">Password recovery</p>
                <h2 id="reset-title">Recover access</h2>
                <p>Use a verified email address or Egyptian phone linked to your Account.</p>
              </div>
            </template>
            <template #form>
              <FloatingField id="recovery-identifier" label="Verified email or phone" name="recovery-identifier" autocomplete="username" value="name@example.com" placeholder="name@example.com or +20 10 1234 5678" />
              <StatusLine kind="neutral">If the Account exists, a reset code will be sent to the verified channel.</StatusLine>
              <AppButton @click="navigate('new-password')">Send reset code</AppButton>
              <p class="switch-line">
                Remembered it?
                <button type="button" @click="navigate('login')">Back to login</button>
              </p>
            </template>
          </AuthScreen>

          <AuthScreen id="new-password" title-id="new-password-title" variant="new" :active="activeId === 'new-password'">
            <template #hero>
              <BrandMark label="Back to login" @navigate="navigate" />
              <ViewSwitchers
                :locale="locale"
                :theme="theme"
                @toggle-locale="toggleLocale"
                @toggle-theme="toggleTheme"
              />
              <div class="hero-copy">
                <p class="eyebrow">Create new password</p>
                <h2 id="new-password-title">Set a fresh password</h2>
                <p>Enter the reset code, then choose a new password for this Account.</p>
              </div>
            </template>
            <template #form>
              <FloatingField id="reset-code" label="Reset code" name="reset-code" inputmode="numeric" value="608244" placeholder="6 digit code" />
              <FloatingField id="new-password-value" label="New password" name="new-password" type="password" autocomplete="new-password" placeholder="Enter new password" />
              <FloatingField id="confirm-new-password" label="Confirm new password" name="confirm-new-password" type="password" autocomplete="new-password" placeholder="Repeat new password" />
              <StatusLine kind="info">Password mismatch keeps your reset code and fields available.</StatusLine>
              <AppButton @click="navigate('login')">Update password</AppButton>
            </template>
          </AuthScreen>

          <AuthScreen id="one-last-step" title-id="google-title" variant="google" :active="activeId === 'one-last-step'" compact>
            <template #hero>
              <BrandMark label="Back to login" @navigate="navigate" />
              <ViewSwitchers
                :locale="locale"
                :theme="theme"
                @toggle-locale="toggleLocale"
                @toggle-theme="toggleTheme"
              />
              <div class="hero-copy">
                <p class="eyebrow">One Last Step</p>
                <h2 id="google-title">Complete your profile</h2>
                <p>Google sign-in succeeded. Add the required phone details before building resolution.</p>
              </div>
            </template>
            <template #form>
              <IdentityCard />
              <FloatingField id="google-phone" label="Egyptian phone" name="google-phone" type="tel" autocomplete="tel" value="+20 10 1234 5678" placeholder="+20 10 1234 5678" />
              <OtpRow label="WhatsApp OTP" :digits="['2', '5', '8', '0', '1', '4']" compact />
              <label class="check-row">
                <input type="checkbox" name="google-terms" checked />
                <span>I accept the terms for Building Suit portal access.</span>
              </label>
              <StatusLine kind="neutral">One Last Step is only reachable after a successful Google callback.</StatusLine>
              <AppButton>Finish setup</AppButton>
              <p class="switch-line">
                Use password instead?
                <button type="button" @click="navigate('login')">Back to login</button>
              </p>
            </template>
          </AuthScreen>
        </div>
      </section>
    </main>
  `
};
