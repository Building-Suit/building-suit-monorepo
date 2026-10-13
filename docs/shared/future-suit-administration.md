# Future Suit administration registration

BS-SA-UI-R002 is implemented by `BsSuitAdministrationRegistration` from `@building-suit/contracts` and `administrationShellRegistration` / `administrationCapabilitySupported` from `@building-suit/ux`. A future Suit supplies data and product-owned adapters; `BsAdministrationShell` receives its existing `suits` and `groups` props. No shell product-name switch, local component, vendor import or presentation class is needed.

## Registration

Use contract version `1`. Supply a stable identity ID, translated label and a canonical Hugeicons name or brand logo URL. Context groups and items have stable IDs, translated labels, optional icons/routes and optional capability dependencies. Suit IDs must be unique across the registry; group IDs and context IDs must be unique within the selected Suit. The registration adapter rejects duplicate IDs rather than ambiguously selecting a route.

Declare product read projections and commands separately as operation maps. Each operation specifies its version, input and output types. The mapped descriptors and adapters preserve those types, so an adapter cannot silently accept another version or return an incompatible result. Capabilities are optional: omit unsupported operations. Descriptors contain labels, versions and optional enabled state; adapters contain the matching version and asynchronous `execute` handler. Bump the operation version when changing its input/output semantics. The host must request an exact supported version; there is no automatic fallback or conversion.

[The executable future-Suit fixture](../../packages/contracts/tests/fixtures/future-suit.ts) demonstrates a version-1 overview projection, a disabled version-2 archive command and an unsupported export projection. Its synthetic adapters are test examples, not production APIs.

## Host integration

```ts
import { administrationShellRegistration, administrationCapabilitySupported } from '@building-suit/ux'

// Registry and selectedSuit are host-owned request/session state.
const { suits, groups } = administrationShellRegistration(registry, selectedSuit)
// Pass these values to BsAdministrationShell; render working content with Bs components.
const supported = administrationCapabilitySupported(registration, {
  kind: 'read', id: 'overview', version: 1,
})
```

Recompute these inputs on registration, access, locale or context changes. The helper never invokes an adapter. A navigation dependency is supported only when the descriptor is enabled and its exact positive integer version matches an executable adapter. All dependencies must pass. Unsupported navigation is hidden by default; `unsupported: 'disable'` retains a disabled affordance. Empty groups disappear. An unavailable contract version disables the rail entry and produces no context navigation. Disabled Suits also produce no navigation. Unknown selection yields no groups. Ungated navigation remains available for ordinary non-capability context routes.

Before dispatch, check support again and use the typed product adapter. No descriptor is an authorization grant. The product server must authenticate the caller, resolve trusted portal/tenant context and authorize every read and command. Client-selected Suit/portal IDs never provide authority. `BsAdministrationRequestContext` carries environment, portal, user, tenant and cancellation signal; it carries no credentials. Product adapters retain query validation, RPC contracts, atomic writes, audit/financial rules and safe error mapping. Shared UI never imports product internals or schemas.

Keep registries and adapter instances request/session scoped. Abort old requests, discard stale results and clear sensitive view/draft/cache state on account, tenant, environment or session changes. Cache keys must include those scopes, Suit ID, operation/version and query parameters. Use the existing shared record-action, confirmation and overlay controllers for commands, and Bs-only loading, empty, denied, error and success presentation. Translation, RTL, theme and accessibility remain governed by the shared shell and components.

## Verification

The task's three executable tests cover TypeScript incompatibilities, data/adapter onboarding and fail-closed navigation, plus strict boundaries and workspace ownership for every discovered Suit. Existing shell inputs and rendered behavior are unchanged. Adding a production Suit still requires its product-owned authorization tests and independent environment configuration; registration does not provision projects or share identities.
