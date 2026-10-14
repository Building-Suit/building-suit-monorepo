# Staging migration history reconciliation — 2026-10-10

The Supabase Git integration rejected staging with `Remote migration versions not found in local migrations directory`. A read-only Management API query, using explicit immutable project refs verified against live GitHub integration settings and the CLI project/organization inventory, established existing applied history.

- Shop staging: `jvvelvftpfnlogalgxgv`, organization `rfolwdswbxddqtqaombc`, working directory `apps/shop-suit`, branch `stg`.
- Super Admin staging: `lwecnmsosfwovlzxauml`, organization `zqrauabsauonyyozqdlh`, working directory `apps/super-admin-suit`, branch `stg`. The maintained environment map has not yet recorded this provider identity.
- Ledger staging: `yqculoltqsyfastmihmu`; its applied versions are already represented in staging source.

This repair restores eleven complete recorded SQL payloads byte for byte. It does not change applied version metadata, replay SQL, edit provider settings, or introduce an unapplied hosted migration. It preserves later feature PRs for independent review and merge. Production/main are outside this operation.

| Product | Applied version | Name | SHA256 |
| --- | --- | --- | --- |
| shop | 20261009222852 | secure_private_offer_handshake | `d180b288c4f11cff42048d40580e17ef418570fc602e0d234ef976af7c068383` |
| shop | 20261009232824 | private_offer_owner_projection | `ea1f7f129b6004912b18c8fe660fd715b4fd6770f5ab8a16e16579c2c25c0839` |
| shop | 20261010123311 | sas_billing_configuration_compat | `e5dab3ad69feb208fa00de33ac3ba3fc9c714b1703bfebd0e2677152cdf49b78` |
| super-admin | 20261006210000 | registry_navigation | `798e16d6f966cb1c908c18115a0133e92eb9b03cccd0079b88bac7349119ba99` |
| super-admin | 20261007070000 | shop_adapter_dispatch | `f96f6d6d646dd4cce329ad944257c97b87706f38cfa60a2ff9018b1ccd9e639b` |
| super-admin | 20261007180000 | manual_transfer_control | `c7fc8f18916968f92a5a5510102a281660628d1d3efc9ffe5f11ea12c088412c` |
| super-admin | 20261007220000 | payment_review_control | `e9c9c9039726c973c6f11cab7fa1425aef71d34d5c112a84fef7fae674587ee5` |
| super-admin | 20261009140000 | private_custom_offers | `343016ea1d054576b8a672022a7da6a34346f8a943daf0c070a006ea586d721c` |
| super-admin | 20261009150000 | normalized_activity | `acc0e3a8536b351077a00799c8920d23f082f8e19472ef36bcc7fb57a61ea608` |
| super-admin | 20261009223658 | signed_private_offer_dispatch | `3586142127ef60a3000f2d2280e5ba0d46d6f8f7c1368814807cb967c5e3b1ab` |
| super-admin | 20261010014246 | preserve_m1_registry_modules | `4889a33c9b29cecf06ce0a9b8ff0161af45f88f0fa6166d54f7a90f6174cfb7f` |

Nine payloads match their existing prerequisite PR source bytes exactly. The Shop compatibility migration and Super Admin payment-review migration existed only in hosted history. Existing migration files are unchanged, including an earlier recipient-offer file whose hosted record differs from source; this repair does not rewrite that history.

The private-offer owner projection retains its recorded terminal blank line. The whitespace check excludes only `blank-at-eof` to preserve the applied bytes; all other whitespace checks remain enabled.

Verification: the complete combined Super Admin chain applies to a separately named disposable local project and all 98 SQL assertions pass. Workspace check, 971 unit tests (22 skipped), and root lint pass on this staging candidate. The complete staging-root GitHub workflow remains required before merging. Fresh provider outcomes must be inspected afterward. No hosted SQL mutation was executed for this repair.

Future Shop migrations that are absent from hosted history remain subject to explicit staging authorization and verified recovery/security gates. Restoring existing history does not grant permission for those mutations or complete real staging payment-review acceptance.
