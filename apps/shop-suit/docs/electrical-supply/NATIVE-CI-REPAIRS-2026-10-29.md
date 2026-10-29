# Native electrical CI qualification repairs

## Initial real execution at00998a7a

PR #515 native run40942184261/job123688139545 successfully initialized owned native Shop Supabase, passed the public-command SQL suites (including capacity and measured/FIFO companion), native serialization and existing financial race checks, and built the current Shop application. Both actual browser cases then failed at the email-to-password transition before checkout: the password control did not become available. This is not native financial acceptance.

The existing production email-step endpoint requires a private lookup credential; the native test server previously supplied only the public client key. The fixture now obtains the same guarded fixed-loopback CLI status and supplies its generated existing key only through SHOP_AUTH_EMAIL_LOOKUP_KEY in the server process, with the verified local URL. Public environment values contain only the public key. Hosted/wrong-port/credential-bearing targets, missing keys and shared public/private keys reject. No hosted credential, provider configuration, auth guard, deadline, retry or assertion is relaxed. The driver now asserts the actual email-step response succeeds and returns canContinue:true before looking for the password control, so a setup failure is diagnosed directly.

Three private/public environment-boundary unit checks and both synthetic EN/AR login-driver regressions pass locally. Lint/normal provenance checks and a new exact-head native/full CI result remain required before acceptance. Raw initial failure log remains locally retained; its summary above contains no Auth session material. Native traces/video/screenshots remain disabled.

## Second real execution atb3c1e3b7

Native run40943965048/job123694311651 passed actual account/merchant/purchase setup and both UI logins. Both cases then failed at the first item-add click: the catalog deliberately exposes image and footer buttons with the same Add action/name. This is a strict locator ambiguity, not a financial/authorization failure. The test driver now explicitly chooses the image add surface. It is shared with separate, explicitly synthetic EN/AR three-line control regressions, which pass against the real built UI, including250g selection and exact outgoing measured-line payloads. Native cases still use actual Auth/public financial RPCs and import no synthetic transport. The real browser checkout stage is still unqualified pending a new owned-runner result. No assertions, time budgets or retries are relaxed.
