# Scoped Realtime refresh

See the [cross-Suit adoption review](realtime-adoption.md) for BS-LAUNCH-R14 decisions and source evidence. Adoption prerequisites in other Suits do not change a passed Shop launch qualification.

`createScopedRealtime` from `@building-suit/data-access` owns one mounted feature's Supabase Postgres Changes subscription. It accepts an explicit Supabase client, scope, schema/table/event/row filters, data keys and refresh callback. It contains no product queries, global client, global registry, UI notifications or auth watcher. There is no additional UX policy needed for this foundation.

Create a controller in client-side feature setup, never in module scope or during SSR. Reuse it for the feature's lifetime. Call `update(binding)` whenever auth identity, tenant, location, context, filters or data keys change; call `update(null)` immediately when auth/scope is unavailable and `dispose()` on unmount. Observe returned promises to surface setup/cleanup failures. A new Supabase client/project needs a new controller after disposal of the old one. Multiple mounted independent features deliberately have independent controllers; do not create controllers in reactive watchers.

The scope includes environment, portal, user, tenant, opaque session identity, nullable location and a context key. The session identity is a non-secret application identifier that changes on session replacement, never an access/refresh token. Context keys must encode feature and relevant query parameters. Data keys must come from the product's scoped query/cache contract, including location/context where relevant. Pass explicit filters; the controller never guesses a tenant column or schema. Scope values and channel names are not authorization: product RLS, grants and trusted session context remain the security boundary. Products own publications and table eligibility, including provider limitations on DELETE filters.

```ts
const realtime = createScopedRealtime(supabase)
await realtime.update({
  scope: currentScope,
  filters: productRealtimeFilters,
  dataKeys: scopedDataKeys,
  async refresh({ signal, isCurrent, scope, dataKeys }) {
    const result = await repository.read(scope, { signal })
    if (isCurrent()) applyResult(dataKeys, result)
  },
  onError(kind) { setRealtimeHealth(kind) },
})
// Product lifecycle integration must observe these promises:
await realtime.update(null)
await realtime.dispose()
```

Updates snapshot inputs and invalidate previous callbacks synchronously. Pending refresh timers are canceled, active refresh signals are aborted and old events/status callbacks are ignored. Refresh code must honor the signal or check `isCurrent()` before applying asynchronous results. Identical updates reuse the channel and replace callbacks. Duplicate filters within a binding are registered once. Context changes serialize channel removal before creating a replacement, skipping intermediate rapid updates. Channel names use opaque random IDs without user/session/context details.

Initial subscription and reconnect success schedule reconciliation through the same refresh throttle as changes. Supabase owns transport reconnects; this layer never opens extra retry channels. The default 250 ms window coalesces bursts, allows one refresh at a time per context and retains one trailing refresh for changes received while work is pending. Errors never trigger refetch retries. Subscription errors notify once per context; refresh failures notify once per attempted refresh. `connected` reports transport subscription health, not authorization or data freshness. Products may show stale/offline state without issuing competing retries.

Cleanup failure rejects the lifecycle promise and blocks replacement. An explicit repeated `update(binding)` retries cleanup. Setup failures retain partially created channels for removal on the next update or disposal. Never assume a failed disposal removed a channel; handle it as a lifecycle failure. The controller removes only its own channel and never disconnects the shared Supabase client.

The transport uses Supabase's supported [subscription callbacks](https://supabase.com/docs/reference/javascript/subscribe) and [channel removal](https://supabase.com/docs/reference/javascript/removechannel). Deterministic coverage lives in `packages/contracts/tests/bs-realtime-foundation-001-1.test.mjs`; existing scope and UX tests and representative Ledger/Shop builds verify the shared package boundary. This task does not enable product subscriptions or change database/provider configuration.
