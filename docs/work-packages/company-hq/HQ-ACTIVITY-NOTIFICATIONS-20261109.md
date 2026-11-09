# HQ activity notifications

The founder started notifications on 9 November 2026. The Company Brain backlog
records this work as Ongoing. Mobile work follows live notification acceptance.

The signed-in localhost checkout includes the opt-in controls, the browser
worker and the app API. The pending migration records one queued delivery per
eligible browser for committed chat messages, task and agent-work changes,
task results, plan and staffing changes or decisions, meeting activity and
contributions, learning, trials, and Brain index changes. Private activity
follows its existing founder owner. Lock-screen text is limited to the type of
activity. Heartbeats, read requests, cursor moves and camera controls do not
produce alerts. Existing records are not replayed when a device is enabled.

The Supabase Edge sender claims at most sixteen deliveries per invocation.
The database leases claims, limits retry attempts, drops expired jobs, and
removes subscriptions the browser provider reports as gone. The service worker
uses the delivery ID as a notification tag. A focused HQ tab can play an
optional chime after a user gesture. With HQ closed, the browser and operating
system control sound and notification presentation.

On localhost, when the push sender is unconfigured, a focused HQ tab can
show browser alerts from the existing authenticated live feed. Those alerts
describe the update category. The browser’s existing Allow setting enables
this automatically unless the user turned off HQ alerts. The staging sender
is required for individual activity and for delivery with HQ closed.

## Staging activation

Use the approved repository migration path for Company HQ staging
`dpruoncalmwicrqhqelu`. The staging history already contains the trigger
dependencies. Migration `20261109032511` and Edge function `hq-web-push` were
absent when inspected. The signed-in localhost UI correctly reported that
push was unconfigured. The private sender config and production were not changed.

1. Apply the migration through the HQ staging GitHub integration. Regenerate
   the HQ database types from the applied schema.
2. Deploy the staged Edge function with its scoped dispatch token check.
   Set `HQ_PUSH_DISPATCH_TOKEN` to a dedicated 64-character lowercase hex
   token and store the same value in staging Vault under
   `hq_push_dispatch_token`. Use the environment's VAPID pair as
   `HQ_PUSH_VAPID_PUBLIC_KEY` and `HQ_PUSH_VAPID_PRIVATE_KEY`. Set the sender
   contact as `HQ_PUSH_VAPID_SUBJECT` using a `mailto:` address.
3. Once the function and secrets are ready, enable the one-minute dispatcher
   as the database operator. It checks the delivery queue and makes no HTTP
   request when no delivery is due.

   ```sql
   select cron.schedule(
     'hq-activity-web-push', '* * * * *',
     $$select hq_private.dispatch_push_deliveries('dpruoncalmwicrqhqelu');$$
   );
   ```

4. Set `NUXT_HQ_PUSH_VAPID_PUBLIC_KEY` to the matching public key in the
   staging app and, for a localhost preview using the staging backend, its
   ignored local env file. Keep the private key and dispatch token out of
   Nuxt configuration. Refresh the signed-in founder app. HQ requests browser
   permission on entry when the browser has no saved decision. If the browser
   requires a click, use Enable browser push in the sidebar next to the bell.
   Enable sound in the focused tab.
5. Perform one authorized HQ action and confirm its browser notification
   and sound. Close the tab, perform a second authorized action from another
   session, and verify native delivery. Disable the browser subscription and
   confirm the next action produces no alert on that device. Record the
   evidence before moving the Brain card to Done.

To stop delivery, unschedule `hq-activity-web-push` and unset the public key
in the app environment. A newer release can restore these settings using the
same environment and key pair.

## Verification

The disposable database test exercised the actual founder and push migrations
and the committed chat row trigger. It checked owner isolation, denied RPC
access, no-op updates, retries, stale leases, expired subscriptions and revoked
sessions. The Edge worker passed Deno type checking and built encrypted push
requests with simulated provider responses. The service worker displayed a
notification, signaled sound and focused HQ with simulated browser APIs.
The signed-in localhost browser showed the configuration state and the
Ongoing card. Real delivery and audible acceptance remain open.
