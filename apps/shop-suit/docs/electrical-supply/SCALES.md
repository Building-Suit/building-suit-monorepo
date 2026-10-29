# Optional scale capture and product mass/length relationships

SS-ELEC-505/506 add an online counter-sale adapter. Manual measured entry remains available without a connected scale or Web Serial support. A physical reading creates no stock movement, invoice, payment or accounting entry. The existing authorized sale commands perform those operations.

## Supported protocol and device approval

The initial adapter supports the documented MT-SICS level 0/1 subset over browser Web Serial in a secure context. The primary reference is the manufacturer's [MT-SICS NewClassic manual, document 30014405](https://www.mt.com/dam/product_organizations/laboratory_weighing/basic_weighing/Products/MT-SICS/MANUALS/en/MT-SICS_NewClassic_en_30014405.pdf), read on 2026-10-26. This is a bounded protocol implementation, not certification of every device bearing that protocol name.

A products manager records the location, model, exact serial number, serial settings and an approval reference. Activation requires explicit confirmation. Connect is a staff action using the browser's port chooser. The adapter checks I4 identity and I0 capabilities, requires S and TA, and exposes T only if advertised. It never sends reset (@), zero, calibration or an automatic tare command. The physical device must be verified in on-demand mode; unsolicited output fails closed.

Each reading requests TA, stable S, then TA again. Tare and units must agree; the net weight must be positive. The initial supported host units are kg and g with at most six decimals and the manual's fixed-width ASCII/CRLF frames. Gross is the exact net-plus-tare sum. Dynamic, over/underload, malformed, oversized, disconnected and timed-out responses cannot be confirmed. A staff-confirmed tare is a separate action. Browser readings expire after ten seconds; server initial capture additionally checks freshness. A failed connection cleanup requires reload before reconnecting and leaves manual sales available.

## Product-specific conversion

Ordinary mass products use the existing exact mass conversion. A length product additionally needs an active, location-specific relationship in kg per canonical stock unit, an approval reference and explicit confirmation. Values have up to twelve decimal places. The product, canonical unit and measurement revision are bound to that approval; there is no global meter-to-kilogram conversion. Tracked reels retain their physical length workflow.

The browser preview and server authority calculate the whole ratio without rounding an intermediate kilogram value. The result must fit the product's exact canonical increment and existing quantity bounds. For example, 250g at 0.2kg/m produces exactly 1.25m. Nonrepresentable quantities are rejected. A changed product measurement or retired/revised approval invalidates a pending reading or issuance. Existing issued snapshots and original partial-return costs remain unchanged.

## Capture, retry and history

Staff review the product, converted stock quantity, net, tare, gross and unit before confirming. Each successful capture has an immutable server snapshot with original frames, actor/time and approved device/factor revisions. Cart quantity and unit are locked; remove and weigh again to change them. Stock capacity includes all other lines for the same SKU.

Unknown capture and approval results retain the exact UUID/payload, freeze edits and block dismissal until retry resolves the result. A capture can bind to only one invoice, including after ordinary draft deletion. A duplicate capture cannot appear twice in one invoice. The server revalidates authority, location, subscription, product, approvals, quantity and evidence through ordinary save and issuance. Scale facts are rejected in future quotation snapshots. Setup changes retain named immutable prior/current history with server pagination.

## Qualification boundaries

The focused protocol, transport and exact-conversion tests pass, including malformed capture-read evidence. All19 combined built browser cases pass, including EN/AR desktop/mobile capture, unstable-read recovery, lost-response retry, checkout, setup/history, denied-reader, unsupported-browser and inherited measured/reel/trade/GS1 journeys. The converted stock quantity is asserted in the viewport before confirmation. Real-session SQL races pass duplicate capture requests, competing invoice bindings and approval retirement while a capture waits for the shop lock. Final combined qualification is tracked in VERIFICATION.md.

Serial transport in automated browsers is explicitly synthetic. PostgreSQL schema fixtures use explicit provider stand-ins. Native Supabase, final shared consumers, actual merchant-approved device/model/settings and measured samples, scanner/printer interaction, native Arabic review and hosted rollout are separate acceptance gates. No physical-device or commercial readiness is inferred from fixtures.


Published review: [#496](https://github.com/Building-Suit/building-suit-monorepo/pull/496), sourceb02f38f6. Final Shop build, Shop/Docs typechecks, scoped lint,121-template boundaries, committed release coverage and local2077/2054 tests (zero failures,23 skips) pass. All19 combined built journeys and the separate final6-case built scale/setup run pass. Native exact-source review121554177623, measured-retail121554177774 and website-launch121554178377 pass. Actual logs confirm all13 core SQL suites and new scale races on real Supabase; fixtures still do not certify physical devices. Final E6 and external gates remain open.
