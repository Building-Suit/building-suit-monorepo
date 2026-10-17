# Building Suit — charcoal glass sign-in (root-copy overlay)

Applies to the `Building-Suit/building-suit-monorepo` shared UI architecture. The archive contains **complete files at their repository-relative paths**; it is not an incremental CSS snippet. This replaces the previous navy-glass ZIP, so do not apply that ZIP again afterwards.

## Visual changes

- `packages/design-tokens/tokens.json` restores the canonical **coal dark role palette** from Ledger Suit: background `#0B0B0D`, surface `#141416`, muted `#1C1C1F`, raised `#27272A`. The existing Building Navy (`#16293B`), Premium Gold (`#D89B42`), light theme and semantic status colors stay unchanged.
- `packages/design-tokens/generated/*` are regenerated outputs of `tooling/design-tokens/generate.mjs`, not new editable sources.
- `packages/ui/src/templates/BsAuthLayout.vue` keeps the centered reference card, dots, glow and soft border but uses the neutral coal palette, not blue-tinted surfaces. The **Language · Theme** button sits centered *below*, rather than inside/overlapping, the card. Original `default` and `flat` presentations remain available.
- `packages/ui/src/templates/BsSignInPage.vue` provides a loading arrow during the email-stage request, then a read-only muted email field, animated arrow disappearance, animated password row with arrow, keyboard focus on the password field, and a small **Edit** action to change email. Social sign-in buttons stay available. Both languages and reduced-motion preferences are supported.
- Shop's existing email/password Supabase sign-in logic and Google/GitHub OAuth handlers are preserved. The fallback Shop logo uses the genuine brand asset, not a newly invented logo.

## Email existence and security

**This package intentionally does not disclose whether an account exists.** The public endpoint `apps/shop-suit/server/api/auth/email-step.post.ts` performs server-side email-format validation and returns the **same** `canContinue` response regardless of whether the user is registered. The real registration/credential check still happens securely in `supabase.auth.signInWithPassword` when the password is submitted.

The email-stage arrow shows an actual asynchronous server request, with a minimum 320ms visibility window so the loading indicator can be perceived. It is not an account-existence probe. Revealing account membership before authentication would permit email enumeration. Rate-limited account recovery or verified email possession are safer alternatives when account discovery is a requirement.

Other Suits retain the existing immediate email-first step unless their app orchestration opts into the new typed `validateEmail` event and pending/approved props. All Suits inherit the restored dark tokens and shared layout.

## Install from the **parent of the monorepo**

```bash
unzip -o building_suit_charcoal_glass_overlay.zip -d ./building-suit-monorepo/
cd building-suit-monorepo
pnpm tokens:check
pnpm check
pnpm typecheck
pnpm lint
pnpm dev:shop --current
```

**Back up/commit your affected local edits before overwriting** these files. The archive does not touch Supabase migrations, credentials or production services.

## Acceptance checks

1. Shop `/auth/login` at widths 375 / 768 / 1440+; no horizontal scroll; card centered; settings below card.
2. Light, dark and system themes, with coal surfaces in dark and gold buttons in both modes.
3. Enter a valid email and submit: arrow spins, email becomes read-only and muted, arrow disappears, password input enters with animation and receives focus.
4. Click Edit: password field leaves, email becomes editable; change email and repeat. Test Enter key, invalid email format, wrong password, pending and error states.
5. Arabic/RTL in mobile and desktop, plus OS reduced-motion preference. Provider sign-in only works if corresponding Supabase Auth provider and redirect URLs are configured.

## Verification status

The included generated tokens were regenerated and drift-checked using the repository generator. The package's source syntax, CSS and ZIP entries can be checked offline. A live Nuxt runtime/typecheck and real Supabase authentication tests must still be performed in your checkout before deployment.
