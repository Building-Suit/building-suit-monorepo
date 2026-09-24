-- Building Suit Engineering Control Plane
-- Normalized import of Ledger Suit, Shop Suit, and Inventory Suit handoffs.
-- Generated from the three authoritative handoff JSON files supplied on 2026-09-24.
-- Open implementation decisions are resolved using the product owner's explicit delegation in the same conversation.
-- For Ledger decisions that still require accountant acceptance, metadata records implementation_approval_only/accountant_acceptance_pending.
-- NOTE: Ledger V2-IMP-013 intentionally remains BLOCKED because authoritative dated tax/regulatory evidence is still an external prerequisite.

\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';

INSERT INTO control.suits (slug, display_name, stack_key, app_path, status, metadata)
VALUES ('ledger-suit', 'Ledger Suit', 'ledger-suit', 'apps/ledger-suit', 'active', '{"handoff_current_checkpoint":{"task_id":"V2-IMP-007","title":"Financial Statements, Effective-Dated Mappings, Indirect Cash Flow, and Traceability","verdict":"PASS","branch":"codex/ledger-suit/v2-baseline","pr_number":18,"commit_sha":"310c54f39673abc62c93c32655b4d689d592fe82","published":true},"handoff_import":"2026-09-24"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  stack_key = EXCLUDED.stack_key,
  app_path = EXCLUDED.app_path,
  status = 'active',
  metadata = control.suits.metadata || EXCLUDED.metadata;

INSERT INTO control.suits (slug, display_name, stack_key, app_path, status, metadata)
VALUES ('shop-suit', 'Shop Suit', 'shop-suit', 'apps/shop-suit', 'active', '{"handoff_current_checkpoint":{"task_id":"SS-PAY-001","verdict":"PASS","branch":"codex/shop-suit/ss-pay-001","pr_number":25,"commit_sha":"9709871deeef11b0e963042e0c300565c80e7e39","published":true},"handoff_import":"2026-09-24"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  stack_key = EXCLUDED.stack_key,
  app_path = EXCLUDED.app_path,
  status = 'active',
  metadata = control.suits.metadata || EXCLUDED.metadata;

INSERT INTO control.suits (slug, display_name, stack_key, app_path, status, metadata)
VALUES ('inventory-suit', 'Inventory Suit', 'inventory-suit', 'apps/inventory-suit', 'active', '{"handoff_current_checkpoint":{"task_id":"IS-BOOT-001","title":"Inventory Suit first-class application bootstrap","verdict":"PASS","branch":"codex/inventory-suit/requirements-v1","pr_number":24,"commit_sha":"be7e6186b92cbf25f63f840cb6e031a9447926d4","published":true},"handoff_import":"2026-09-24"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  stack_key = EXCLUDED.stack_key,
  app_path = EXCLUDED.app_path,
  status = 'active',
  metadata = control.suits.metadata || EXCLUDED.metadata;

-- Authoritative requirement rows (ranges expanded to stable IDs).
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-01', 'AP-01', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-02', 'AP-02', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-03', 'AP-03', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-04', 'AP-04', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-05', 'AP-05', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-06', 'AP-06', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-07', 'AP-07', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-08', 'AP-08', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AP-09', 'AP-09', 'Supplier accrual subledger: AP Control binding, bills/open items, payment allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate expense/asset recognition.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-01', 'AR-01', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-02', 'AR-02', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-03', 'AR-03', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-04', 'AR-04', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-05', 'AR-05', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-06', 'AR-06', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-07', 'AR-07', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-08', 'AR-08', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'AR-09', 'AR-09', 'Customer accrual subledger: AR Control binding, invoices/open items, receipt allocation, partial settlement, credits/overpayments/corrections, statements, aging, Control reconciliation and no duplicate revenue.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-01', 'BANK-01', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-02', 'BANK-02', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-03', 'BANK-03', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-04', 'BANK-04', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-05', 'BANK-05', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-06', 'BANK-06', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-07', 'BANK-07', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'BANK-08', 'BANK-08', 'Bank statement import, validation/deduplication, match without reposting, states, adjustments, reconciliation equation and immutable reconciliation history.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'COA-09', 'COA-09', 'Hierarchy and Contra reconciliation are covered; real dated Control-account-to-subledger reconciliation remains pending real AR/AP providers.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-01', 'CORE-01', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-02', 'CORE-02', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-03', 'CORE-03', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-04', 'CORE-04', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-05', 'CORE-05', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-06', 'CORE-06', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-07', 'CORE-07', 'Conditional foreign-currency AR/AP work only if V2-D13 is explicitly approved; existing currency support must otherwise simply be preserved.', 'deferred', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"conditional","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'CORE-08', 'CORE-08', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'DIM-01', 'DIM-01', 'Controlled cost-center/project accounting dimensions, allocations, filtered/grouped reporting, Unassigned reconciliation and no operational project-management expansion.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'DIM-02', 'DIM-02', 'Controlled cost-center/project accounting dimensions, allocations, filtered/grouped reporting, Unassigned reconciliation and no operational project-management expansion.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'DIM-03', 'DIM-03', 'Controlled cost-center/project accounting dimensions, allocations, filtered/grouped reporting, Unassigned reconciliation and no operational project-management expansion.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'DIM-04', 'DIM-04', 'Controlled cost-center/project accounting dimensions, allocations, filtered/grouped reporting, Unassigned reconciliation and no operational project-management expansion.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'DIM-05', 'DIM-05', 'Controlled cost-center/project accounting dimensions, allocations, filtered/grouped reporting, Unassigned reconciliation and no operational project-management expansion.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'DIM-06', 'DIM-06', 'Controlled cost-center/project accounting dimensions, allocations, filtered/grouped reporting, Unassigned reconciliation and no operational project-management expansion.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'DIM-07', 'DIM-07', 'Controlled cost-center/project accounting dimensions, allocations, filtered/grouped reporting, Unassigned reconciliation and no operational project-management expansion.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-01', 'FA-01', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-02', 'FA-02', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-03', 'FA-03', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-04', 'FA-04', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-05', 'FA-05', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-06', 'FA-06', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-07', 'FA-07', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-08', 'FA-08', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FA-09', 'FA-09', 'Fixed-asset register, acquisition links, approved depreciation inputs/schedules, idempotent posting, NBV, disposal, GL reconciliation and corrections.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'FS-08', 'FS-08', 'Effective mapping and archived-account history are implemented; historical descriptive labels after permitted account renaming remain unproven.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-01', 'INV-01', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-02', 'INV-02', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-03', 'INV-03', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-04', 'INV-04', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-05', 'INV-05', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-06', 'INV-06', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-07', 'INV-07', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'INV-08', 'INV-08', 'Approved inventory accounting only: movement/valuation source, controls, costing/COGS, returns/adjustments, GL reconciliation, traceability and explicit exclusion of operational WMS/procurement/manufacturing.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; INV-07 and INV-08 are already established scope guards","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'JRN-02', 'JRN-02', 'Journal metadata is implemented, but final professional sequential journal-number semantics still require V2-D03 approval and follow-up completion.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'JRN-03', 'JRN-03', 'Journal metadata is implemented, but final professional sequential journal-number semantics still require V2-D03 approval and follow-up completion.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'SCOPE-04', 'SCOPE-04', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'SCOPE-05', 'SCOPE-05', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'SCOPE-06', 'SCOPE-06', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'SCOPE-07', 'SCOPE-07', 'Global remaining-work guardrails: accounting-only scope, no ERP expansion, preserve financial history, use one shared double-entry ledger, backend validation, tenant/permission/period/idempotency enforcement, traceable corrections, and pre/post migration reconciliation.', 'implemented', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"CORE-01 through CORE-07 are implemented foundations; CORE-08 requires final cross-module reconciliation evidence.","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'TAX-01', 'TAX-01', 'Explicitly approved and currently verified tax/VAT scope only: configuration, calculations, ledger mappings, reports, reconciliation, regulatory verification and no unsupported compliance claims.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; TAX-05 through TAX-07 are governance constraints already established","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'TAX-02', 'TAX-02', 'Explicitly approved and currently verified tax/VAT scope only: configuration, calculations, ledger mappings, reports, reconciliation, regulatory verification and no unsupported compliance claims.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; TAX-05 through TAX-07 are governance constraints already established","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'TAX-03', 'TAX-03', 'Explicitly approved and currently verified tax/VAT scope only: configuration, calculations, ledger mappings, reports, reconciliation, regulatory verification and no unsupported compliance claims.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; TAX-05 through TAX-07 are governance constraints already established","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'TAX-04', 'TAX-04', 'Explicitly approved and currently verified tax/VAT scope only: configuration, calculations, ledger mappings, reports, reconciliation, regulatory verification and no unsupported compliance claims.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; TAX-05 through TAX-07 are governance constraints already established","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'TAX-05', 'TAX-05', 'Explicitly approved and currently verified tax/VAT scope only: configuration, calculations, ledger mappings, reports, reconciliation, regulatory verification and no unsupported compliance claims.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; TAX-05 through TAX-07 are governance constraints already established","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'TAX-06', 'TAX-06', 'Explicitly approved and currently verified tax/VAT scope only: configuration, calculations, ledger mappings, reports, reconciliation, regulatory verification and no unsupported compliance claims.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; TAX-05 through TAX-07 are governance constraints already established","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'TAX-07', 'TAX-07', 'Explicitly approved and currently verified tax/VAT scope only: configuration, calculations, ledger mappings, reports, reconciliation, regulatory verification and no unsupported compliance claims.', 'approved', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"remaining implementation; TAX-05 through TAX-07 are governance constraints already established","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-01', 'VAL-01', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-02', 'VAL-02', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-03', 'VAL-03', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-04', 'VAL-04', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-05', 'VAL-05', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-06', 'VAL-06', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-07', 'VAL-07', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('ledger-suit', 'VAL-08', 'VAL-08', 'Final validation requires measurable criteria, accounting fixtures, AR/AP lifecycle, bank/assets/dimensions/tax/inventory coverage, security/isolation/idempotency/concurrency/history tests, independent accountant-reviewed balances, and separate code/test/deploy/UAT states.', 'partial', 'normal', 'handoff:ledger-suit.json', NULL, '{"current_state":"partially satisfied by completed tasks; final cross-module and accountant acceptance remains","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'BIZ-03', 'BIZ-03', 'A business may enable/disable irrelevant operational areas without losing history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'BIZ-07', 'BIZ-07', 'Distinguish a product sold to a customer from a stocked material consumed while performing a service.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'BIZ-08', 'BIZ-08', 'Service sales must not require a dedicated job/work-order module. Job/work-order management is a later optional capability unless separately approved.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'CUST-03', 'CUST-03', 'Track original sale amount, payments, credits/returns, and outstanding balance.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_customer_receivable_effects","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'CUST-07', 'CUST-07', 'Customer statement with sales, payments, credits/returns, and running/outstanding balance.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_customer_receivable_effects","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'CUST-10', 'CUST-10', 'Payment history remains traceable to actor, method, date, reference, customer, and related document.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_customer_receivable_effects","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'EXP-01', 'EXP-01', 'Preserve and complete existing paid-expense workflow with categories, dates, notes, status, correction rules, and voiding.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"expenses_and_operational_cash","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'EXP-02', 'EXP-02', 'Expense mutations are idempotent and respect applicable restrictions.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"expenses_and_operational_cash","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'EXP-03', 'EXP-03', 'Search/filter complete expense history rather than only a recent fixed-size list.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"expenses_and_operational_cash","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'EXP-04', 'EXP-04', 'Preserve void/correction history instead of deleting original records.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"expenses_and_operational_cash","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'EXP-05', 'EXP-05', 'Other operational income/cash entries may be supported only with clear semantics that do not duplicate sales revenue.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"expenses_and_operational_cash","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'EXP-06', 'EXP-06', 'Operational cash entries use clear money-source/method labels without pretending Shop Suit is a full general ledger.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"expenses_and_operational_cash","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-01', 'INT-01', 'Shop Suit remains fully operational when Ledger Suit is absent, unsubscribed, unavailable, or disconnected.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-02', 'INT-02', 'Shop Suit owns operational source records: sales, purchases, services sold, stock movements, customers, suppliers, operational payments, and expenses.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-03', 'INT-03', 'Future Ledger Suit owns formal accounting treatment: chart of accounts, journals, posting rules, periods, and formal financial statements.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-04', 'INT-04', 'Do not create a second independent double-entry source of truth inside Shop Suit merely to prepare for ERP.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-05', 'INT-05', 'Operational records that may later produce Ledger entries have stable IDs and traceable finalization history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-06', 'INT-06', 'Future integration must uniquely identify Shop events so retries cannot duplicate Ledger posting.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-07', 'INT-07', 'Corrections/returns/refunds/voids preserve linkage needed for future corrective accounting.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-08', 'INT-08', 'Future integration is failure-tolerant; Ledger unavailability must not block otherwise valid Shop transactions.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-09', 'INT-09', 'erp.building-suit.com is outside current implementation scope.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-10', 'INT-10', 'Cross-product SSO is a separate future decision; do not assume current sessions are unified.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-11', 'INT-11', 'Shared design-system code may be reused, but Shop/Ledger business-data ownership remains explicit.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'INT-12', 'INT-12', 'Do not add integration queues/tables/infrastructure until a concrete contract is approved; only avoid designs that make future integration unnecessarily difficult.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ledger_erp_boundaries","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PAY-01', 'PAY-01', 'One coherent operational payment model for customer receipts, supplier payments, and other supported flows where the data model allows.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PAY-02', 'PAY-02', 'Support practical payment methods such as cash, bank transfer, card, and extensible other method where appropriate.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PAY-03', 'PAY-03', 'Payment records include amount, date, method, reference, status, actor, and related document/counterparty links.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PAY-04', 'PAY-04', 'Payment amount rules must not silently contradict outstanding balances.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PAY-05', 'PAY-05', 'Cancellation/reversal/refund remains traceable and updates balances exactly once.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PAY-06', 'PAY-06', 'Payment tracking remains usable without Ledger Suit.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-02', 'PLAN-02', 'Reuse correct existing functionality; do not rewrite catalog/inventory/expense foundations unnecessarily.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-03', 'PLAN-03', 'Sequence work by dependency rather than page order.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-04', 'PLAN-04', 'Expected dependency direction is generally: current-state/security/data-contract baseline → business/master-data gaps → sales/customer/payment foundation → purchasing/supplier/payment foundation → inventory integration/returns → team/permissions → dashboard/reporting → resource-based subscription/usage after commercial decisions → launch hardening.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-05', 'PLAN-05', 'If repository evidence shows a safer order, document and use it.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-06', 'PLAN-06', 'Every work package specifies requirement IDs, dependencies, affected components, schema/migration needs, preservation risks, acceptance criteria, tests, and handback evidence.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-07', 'PLAN-07', 'Maintain traceability from each requirement ID to implementation status, evidence, tests, and acceptance evidence.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-08', 'PLAN-08', 'Additional useful capabilities are listed as proposed scope additions requiring approval.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-09', 'PLAN-09', 'Do not implement future ERP portal, Ledger integration, generalized SSO, payroll, manufacturing, advanced warehouse management, appointment scheduling, or e-commerce unless separately approved.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PLAN-10', 'PLAN-10', 'Initial baseline/audit may update planning/tracking docs but must not modify runtime behavior, apply functional migrations, or deploy.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"implementation_control","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-01', 'PUR-01', 'Supplier/vendor CRUD/archive/search and contact information.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-02', 'PUR-02', 'Complete supplier purchase/bill workflow; do not rely only on manual stock receipts.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-03', 'PUR-03', 'Stock purchase increases correct inventory cost layers/batches exactly once.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-04', 'PUR-04', 'Capture supplier, date, item quantities, unit costs, totals, and traceability references.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-05', 'PUR-05', 'Support fully and partially paid supplier purchases where supplier credit is allowed.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-06', 'PUR-06', 'Multiple supplier payments with remaining payable balance.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-07', 'PUR-07', 'Purchase/bill list, search, filters, detail, and drill-through to payments and inventory receipts.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-08', 'PUR-08', 'Retries do not duplicate purchase receipt, inventory increase, or supplier payment.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-09', 'PUR-09', 'Preserve supplier/document historical snapshots/equivalent traceability.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-10', 'PUR-10', 'Define supplier credits, returns, overpayments, unallocated/reversed payments before implementing unresolved behaviors.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-11', 'PUR-11', 'Purchase returns reducing stock preserve valuation traceability and never reduce stock twice.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'PUR-12', 'PUR-12', 'P0 does not include purchase requisitions, complex procurement, or advanced approval chains unless separately approved.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"supplier_purchasing_payables","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-01', 'RPT-01', 'Replace readiness/placeholder dashboard content with an owner/operator dashboard once underlying workflows exist.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-02', 'RPT-02', 'Surface actionable sales, collections, receivables, payables, expenses, low stock, and recent activity according to enabled business capabilities.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-03', 'RPT-03', 'Sales reporting by date and applicable product/service dimensions.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-04', 'RPT-04', 'Collection/payment and outstanding-customer reporting.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-05', 'RPT-05', 'Supplier purchase/payment and payable reporting.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-06', 'RPT-06', 'Stock-on-hand, valuation, low-stock, and movement reporting.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-07', 'RPT-07', 'Product/service profitability or margin reporting only where costs/calculations are well-defined and reconcilable.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-08', 'RPT-08', 'Operational expense and operating-result summaries without presenting Shop Suit as a formal accounting ledger.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-09', 'RPT-09', 'Server-side/full-history calculations; do not base business reports only on rows loaded in a page.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-10', 'RPT-10', 'Drill-through to source sale, purchase, payment, customer/supplier, product/service, or stock movement.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-11', 'RPT-11', 'Approved exports must use the same filters/calculations as displayed results.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'RPT-12', 'RPT-12', 'Formal financial statements, chart of accounts, journals, and double-entry accounting are future Ledger Suit responsibilities.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"dashboard_and_reports","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-01', 'SAFE-01', 'Tenant isolation and least privilege for all reachable tables/views/RPCs/functions/storage.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-02', 'SAFE-02', 'Review RLS, grants, ownership/security-definer behavior, and cross-shop references.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-03', 'SAFE-03', 'Referenced customer/supplier/product/service/payment/role/category/document/stock records belong to the same shop where applicable.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-04', 'SAFE-04', 'Protect finalized documents and stock/payment history from traceability-destroying silent mutation.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-05', 'SAFE-05', 'Use idempotency for money-, stock-, sale-, and purchase-affecting mutations that may retry.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-06', 'SAFE-06', 'Concurrency must not allow quota overrun, overselling beyond policy, duplicate numbering, duplicate payment application, or duplicate stock movement.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-07', 'SAFE-07', 'Preserve audit evidence for sensitive actions.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-08', 'SAFE-08', 'Do not casually rewrite applied migration history or existing customer data; use additive/backward-compatible migration strategy where practical.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-09', 'SAFE-09', 'Remote database changes, production/customer data operations, deployment, secrets, and provider settings require explicit authorization.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SAFE-10', 'SAFE-10', 'History remains queryable after catalog archival, staff removal, subscription change, or future integration.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"security_integrity","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SALE-01', 'SALE-01', 'Provide a complete sales workflow, not only invoice tables or dashboard previews.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_sale_documents_and_corrections","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SALE-02', 'SALE-02', 'One sale may contain product lines, service lines, and approved custom/manual lines.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_sale_documents_and_corrections","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SALE-03', 'SALE-03', 'Define consistent document lifecycle states such as draft and finalized/issued; additional states must be explicit.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_sale_documents_and_corrections","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SALE-12', 'SALE-12', 'Printable/shareable customer document suitable for small-business use.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_sale_documents_and_corrections","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SALE-13', 'SALE-13', 'Define correction/void/refund/return behavior without silently rewriting finalized history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_sale_documents_and_corrections","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SALE-14', 'SALE-14', 'Sales returns restoring stock must restore it exactly once and preserve link to the original sale.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_sale_documents_and_corrections","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SALE-15', 'SALE-15', 'Tax/VAT behavior requires approved tax scope; do not claim compliance merely because tax fields exist.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"remaining_sale_documents_and_corrections","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SCOPE-05', 'SCOPE-05', 'Preserve existing correct functionality and data. Extend working implementations instead of rebuilding them without evidence that replacement is required.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ongoing_scope_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SCOPE-06', 'SCOPE-06', 'Shop Suit scope covers small-business operations: catalog, services, sales, customers, payments, suppliers, purchasing, inventory, expenses, staff/permissions, operational reporting, subscriptions/limits, settings, and launch readiness.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ongoing_scope_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SCOPE-07', 'SCOPE-07', 'Do not silently expand Shop Suit into a full general ledger, payroll system, manufacturing ERP, advanced warehouse-management system, full CRM, e-commerce platform, or appointment platform.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ongoing_scope_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SCOPE-08', 'SCOPE-08', 'Industry-specific features such as serial numbers, lot/expiry tracking, appointments, warranties, loyalty, complex warehouse transfers, or manufacturing must be proposed separately unless already approved.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ongoing_scope_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SCOPE-09', 'SCOPE-09', 'When product or commercial behavior is unresolved, record an explicit decision requiring product-owner approval rather than inventing a permanent policy.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ongoing_scope_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SCOPE-10', 'SCOPE-10', 'Current code, database objects, or old plans are evidence of current implementation, not automatic proof of the desired final product.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ongoing_scope_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SERV-05', 'SERV-05', 'A service may optionally consume stocked materials when an approved workflow explicitly records consumption.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"service_material_consumption","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SERV-06', 'SERV-06', 'Material consumed during service delivery must not create a second customer charge unless explicitly sold as a separate sale line.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"service_material_consumption","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SERV-07', 'SERV-07', 'Service writes enforce tenant access, permissions, subscription state, and applicable quotas in the backend.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"service_material_consumption","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SET-01', 'SET-01', 'Coherent business settings for business name and approved profile details.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"settings","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SET-02', 'SET-02', 'Invoice/receipt display settings required by finalized documents.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"settings","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SET-03', 'SET-03', 'Business-level defaults such as currency and approved operational preferences.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"settings","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SET-04', 'SET-04', 'Settings changes do not rewrite historical finalized documents.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"settings","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SET-05', 'SET-05', 'Future branch/location support must be explicit, not implied accidentally.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"settings","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-01', 'STOCK-01', 'Preserve the existing batch/movement foundation where correct.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-02', 'STOCK-02', 'Maintain traceable movements for receipts, sales, returns, write-offs, and approved adjustments.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-03', 'STOCK-03', 'Stock on hand reconciles to movement/batch history; it is not an independently editable authoritative number.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-04', 'STOCK-04', 'Inventory-changing operations are atomic, concurrency-safe, and idempotent.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-05', 'STOCK-05', 'Preserve cost-layer/batch data required by approved costing behavior.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-06', 'STOCK-06', 'Do not silently change FIFO/other costing policy; changes require explicit approval and migration/reconciliation planning.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-07', 'STOCK-07', 'Product inventory history includes date, movement type, quantity, source/reference, and actor where relevant.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-08', 'STOCK-08', 'Manual receipt/write-off/adjustment workflows require reason/reference where appropriate.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-09', 'STOCK-09', 'Controlled physical stock-count workflow with variance history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-10', 'STOCK-10', 'Low-stock/reorder threshold and actionable low-stock view.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-11', 'STOCK-11', 'Prevent negative stock unless an explicit approved negative-stock policy exists.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-12', 'STOCK-12', 'Archived/discontinued stocked products remain visible where needed for stock, valuation, and history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-13', 'STOCK-13', 'Inventory valuation reconciles to the cost layers/movements used by Shop Suit.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'STOCK-14', 'STOCK-14', 'Multi-warehouse/multi-location stock is outside initial core unless separately approved.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"inventory_stock","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-01', 'SUB-01', 'Shop Suit remains independently subscribable with its own website, onboarding, management, and subscription lifecycle.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-02', 'SUB-02', 'Entitlement architecture must support resource-based plan limits instead of permanently binding business type to subscription tier.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-03', 'SUB-03', 'Exact plan names, prices, quotas, and final commercial limits remain product-owner decisions unless explicitly supplied later.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-04', 'SUB-04', 'Existing Basic/Pro values and inventory gating are current implementation evidence, not automatically approved final terms.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-05', 'SUB-05', 'Quotas enforced in backend with concurrency-safe rules.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-06', 'SUB-06', 'Usage is understandable before an operation is rejected.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-07', 'SUB-07', 'Downgrade/expiry never deletes historical data.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-08', 'SUB-08', 'Define history-read access and write restrictions after expiry.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-09', 'SUB-09', 'Define over-limit downgrade behavior; do not silently archive/delete data.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-10', 'SUB-10', 'Retried/idempotent operations do not consume quota twice.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-11', 'SUB-11', 'Subscription/settings view shows plan, trial/renewal state, usage, and approved upgrade/downgrade actions.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'SUB-12', 'SUB-12', 'Subscription payment-provider implementation is outside this pack unless separately supplied.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"subscriptions_quotas_commercial","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-01', 'TEAM-01', 'Complete team-management interface, not only membership tables.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-02', 'TEAM-02', 'Controlled staff invitation/addition workflow.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-03', 'TEAM-03', 'Active, suspended/disabled, and removed states with preserved history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-04', 'TEAM-04', 'Granular permissions; useful staff actions must not require owner status by default.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-05', 'TEAM-05', 'Permissions distinguish view/manage for products/services, inventory, sales, purchases, payments, expenses, reports, and team/settings where supported.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-06', 'TEAM-06', 'Sensitive actions such as discounts, refunds, stock adjustments, supplier payments, viewing cost/profit, and permission administration should be independently controllable where practical.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-07', 'TEAM-07', 'Permissions enforced in backend/RLS/RPC; hiding UI controls is insufficient.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-08', 'TEAM-08', 'Suspended/removed members lose protected access according to the auth model’s actual guarantees.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEAM-09', 'TEAM-09', 'Sensitive staff actions are auditable.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"team_permissions","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-01', 'TEN-01', 'All business data must be isolated by shop/business tenant.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-02', 'TEN-02', 'Users may read or mutate only shops with an active authorized membership.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-03', 'TEN-03', 'Shop switching must not leak cached/stale data from a previously selected shop.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-04', 'TEN-04', 'A shop must have explicit owner/administrative authority.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-05', 'TEN-05', 'Ownership transfer, suspension/removal, and shop-status changes preserve history and access control.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-06', 'TEN-06', 'Shop Suit authentication remains independently usable without future ERP SSO.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-07', 'TEN-07', 'Do not couple Shop Suit auth to Ledger Suit unless separately approved.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'TEN-08', 'TEN-08', 'Destructive tenant actions must not silently delete sales, purchase, payment, expense, or inventory history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"business_and_tenancy_guardrails","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-01', 'UX-01', 'Preserve Arabic/English with correct RTL/LTR behavior.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-02', 'UX-02', 'Use the Building Suit design system and existing Shop Suit conventions.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-03', 'UX-03', 'Important forms have clear labels, validation, loading, error, success, empty, and permission-denied states.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-04', 'UX-04', 'Money/stock-impacting actions communicate their effect before confirmation.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-05', 'UX-05', 'Wording clearly distinguishes sale, payment, purchase, receipt, stock adjustment, expense, refund, and return.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-06', 'UX-06', 'Realistic record volumes use pagination/server-side querying instead of arbitrary history-hiding caps.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-07', 'UX-07', 'Created/edited records appear correctly without manual browser refresh.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-08', 'UX-08', 'Responsive/mobile-first and accessible interactions remain consistent with the design system.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-09', 'UX-09', 'Status is not communicated by color alone.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'UX-10', 'UX-10', 'UI must not advertise a workflow as available when only schema foundation exists.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"ux_localization","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-01', 'VAL-01', 'Measurable acceptance criteria for every implementation task/requirement group.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-02', 'VAL-02', 'Test product-only, service-only, and mixed businesses.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-03', 'VAL-03', 'Test a mixed sale containing both stocked product and service.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-04', 'VAL-04', 'Test retry/double-submit so sale, purchase, payment, expense, or stock movement is not duplicated.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-05', 'VAL-05', 'Test purchase receipt → stock increase → sale → stock decrease → return/correction where implemented.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-06', 'VAL-06', 'Test partial customer payment and partial supplier payment where implemented.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-07', 'VAL-07', 'Test stock insufficiency and concurrent stock-changing operations.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-08', 'VAL-08', 'Test archived/discontinued products with remaining stock/history.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-09', 'VAL-09', 'Test owner/staff permissions, suspended membership, outsider access, and cross-shop isolation.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-10', 'VAL-10', 'Test quota enforcement and downgrade/expiry behavior for implemented limits.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-11', 'VAL-11', 'Test Arabic/English, RTL/LTR, responsive layout, and important empty/error/loading states for changed flows.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-12', 'VAL-12', 'Reconcile operational reports to their source records.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('shop-suit', 'VAL-13', 'VAL-13', 'Distinguish code implemented, automated tests passed, manually verified, deployed, and commercially approved.', 'approved', 'normal', 'handoff:shop-suit.json', NULL, '{"group":"validation","source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-01', 'ADJ-01', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-02', 'ADJ-02', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-03', 'ADJ-03', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-04', 'ADJ-04', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-05', 'ADJ-05', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-06', 'ADJ-06', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-07', 'ADJ-07', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-08', 'ADJ-08', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-09', 'ADJ-09', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ADJ-10', 'ADJ-10', 'Controlled gain/loss adjustments, damaged/write-off/scrap disposition, reason/approval, immutable movement history, idempotency, failure atomicity, reversal/correction and traceable valuation impact.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"adjustments_writeoff_scrap","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-01', 'BAR-01', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-02', 'BAR-02', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-03', 'BAR-03', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-04', 'BAR-04', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-05', 'BAR-05', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-06', 'BAR-06', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-07', 'BAR-07', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'BAR-08', 'BAR-08', 'Internal barcode lookup, GTIN, future GS1 AI parsing architecture, keyboard-wedge scanning, structured tracking scans and ambiguity prevention; SSCC remains future-safe and camera/offline scanning is deferred.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"barcodes_gs1","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-01', 'COST-01', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-02', 'COST-02', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-03', 'COST-03', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-04', 'COST-04', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-05', 'COST-05', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-06', 'COST-06', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-07', 'COST-07', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-08', 'COST-08', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-09', 'COST-09', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-10', 'COST-10', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-11', 'COST-11', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-12', 'COST-12', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-13', 'COST-13', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-14', 'COST-14', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-15', 'COST-15', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COST-16', 'COST-16', 'V1 valuation uses FIFO, weighted/moving average and specific identification; valuation is distinct from removal; calculations are exact and deterministic; receipts/issues/transfers/adjustments preserve value; historical/as-of valuation is reproducible and Inventory never posts Ledger journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"valuation","current_state":"MISSING; COST-11 requires IS-D10 and COST-14 requires IS-D02.","blocking_decision_ids":["IS-D02","IS-D10"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-01', 'COUNT-01', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-02', 'COUNT-02', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-03', 'COUNT-03', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-04', 'COUNT-04', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-05', 'COUNT-05', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-06', 'COUNT-06', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-07', 'COUNT-07', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-08', 'COUNT-08', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-09', 'COUNT-09', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-10', 'COUNT-10', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-11', 'COUNT-11', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-12', 'COUNT-12', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-13', 'COUNT-13', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-14', 'COUNT-14', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-15', 'COUNT-15', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-16', 'COUNT-16', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'COUNT-17', 'COUNT-17', 'Full/cycle counts with scope, assignments, scheduling, blind mode, visibility policy, barcode entry, tracked dimensions, recounts, auditable snapshot/cutoff, concurrent movement handling, lifecycle and variance-to-adjustment posting.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"physical_counts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-01', 'ETA-01', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-02', 'ETA-02', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-03', 'ETA-03', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-04', 'ETA-04', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-05', 'ETA-05', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-06', 'ETA-06', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-07', 'ETA-07', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-08', 'ETA-08', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ETA-09', 'ETA-09', 'Optional GS1/EGS/ETA codes, independent internal SKU, GTIN/GPC and ETA UOM metadata; Egypt readiness must not force Egypt-specific tax metadata on other tenants or make Inventory responsible for tax filing.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"egypt_eta_item_coding","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-01', 'IMP-01', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-02', 'IMP-02', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-03', 'IMP-03', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-04', 'IMP-04', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-05', 'IMP-05', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-06', 'IMP-06', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-07', 'IMP-07', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-08', 'IMP-08', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-09', 'IMP-09', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'IMP-10', 'IMP-10', 'Structured item/opening/count import/export with whole-file and row-level validation, duplicate protection, tenant authorization, retry safety, permissioned exports and correct Arabic/English round-trip.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"import_export","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-01', 'INT-01', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-02', 'INT-02', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-03', 'INT-03', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-04', 'INT-04', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-05', 'INT-05', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-06', 'INT-06', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-07', 'INT-07', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-08', 'INT-08', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-09', 'INT-09', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-10', 'INT-10', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-11', 'INT-11', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-12', 'INT-12', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-13', 'INT-13', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'INT-14', 'INT-14', 'Optional integration using stable external identifiers, idempotent inbound commands, transactional outbox/reliable persistence, retry safety, failure isolation, versioned contracts, separate databases, no email-only authorization, one Shop stock authority and Ledger-owned journals.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"integration_architecture","current_state":"MISSING. IS-D08 and IS-D11 govern future live activation/mapping but do not block core integration foundations.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-01', 'ISSUE-01', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-02', 'ISSUE-02', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-03', 'ISSUE-03', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-04', 'ISSUE-04', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-05', 'ISSUE-05', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-06', 'ISSUE-06', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-07', 'ISSUE-07', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-08', 'ISSUE-08', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-09', 'ISSUE-09', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ISSUE-10', 'ISSUE-10', 'Manual warehouse issues independent of Sales with location/tracking dimensions, authoritative availability validation, partial issue, atomic stock/value effects, idempotency, reversal and configured valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"issues","current_state":"MISSING; operational removal defaults/ties require IS-D04.","blocking_decision_ids":["IS-D04"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-01', 'ITEM-01', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-02', 'ITEM-02', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-03', 'ITEM-03', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-04', 'ITEM-04', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-05', 'ITEM-05', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-06', 'ITEM-06', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-07', 'ITEM-07', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-08', 'ITEM-08', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-09', 'ITEM-09', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-10', 'ITEM-10', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-11', 'ITEM-11', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-12', 'ITEM-12', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-13', 'ITEM-13', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-14', 'ITEM-14', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-15', 'ITEM-15', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'ITEM-16', 'ITEM-16', 'Stable Inventory-owned item master with archive lifecycle, bilingual metadata, SKU/barcodes, grouping, manufacturer/origin/customs data, base UOM, tracking mode, valuation method, removal strategy and history-safe structural settings.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"item_master","current_state":"MISSING; ITEM-16 requires IS-D03 for final acceptance.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-01', 'LOC-01', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-02', 'LOC-02', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-03', 'LOC-03', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-04', 'LOC-04', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-05', 'LOC-05', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-06', 'LOC-06', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-07', 'LOC-07', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-08', 'LOC-08', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-09', 'LOC-09', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-10', 'LOC-10', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-11', 'LOC-11', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-12', 'LOC-12', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-13', 'LOC-13', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOC-14', 'LOC-14', 'Hierarchical locations including storage, receiving, dispatch/picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations, with history-safe hierarchy, cycle-count frequency, removal strategy and barcode identity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"locations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-01', 'LOCK-01', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-02', 'LOCK-02', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-03', 'LOCK-03', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-04', 'LOCK-04', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-05', 'LOCK-05', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-06', 'LOCK-06', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-07', 'LOCK-07', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-08', 'LOCK-08', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'LOCK-09', 'LOCK-09', 'Effective timestamps, explicit backdating permission, Inventory lock periods, locked-history enforcement, deterministic valuation recomputation, immutable source business quantities, auditability and failure atomicity; Ledger periods remain separate.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"backdating_inventory_locks","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-01', 'MOV-01', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-02', 'MOV-02', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-03', 'MOV-03', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-04', 'MOV-04', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-05', 'MOV-05', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-06', 'MOV-06', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-07', 'MOV-07', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-08', 'MOV-08', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-09', 'MOV-09', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-10', 'MOV-10', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-11', 'MOV-11', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-12', 'MOV-12', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-13', 'MOV-13', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-14', 'MOV-14', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-15', 'MOV-15', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-16', 'MOV-16', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-17', 'MOV-17', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'MOV-18', 'MOV-18', 'Finalized stock-changing operations create immutable tenant-scoped documents and movement legs containing normalized quantity, source/destination, tracking dimensions, references, timestamps, actor/reason, reversal links and deterministic ordering. Balances are reconstructable and reconcilable.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_documents_movements","current_state":"MISSING.","blocking_decision_ids":["IS-D07"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NEG-01', 'NEG-01', 'Negative available stock is blocked by default; finalization revalidates server-side; lot/serial inventory cannot logically go negative. Future exceptions are deferred and are not part of V1.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"negative_stock","current_state":"MISSING; no unresolved V1 decision.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NEG-02', 'NEG-02', 'Negative available stock is blocked by default; finalization revalidates server-side; lot/serial inventory cannot logically go negative. Future exceptions are deferred and are not part of V1.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"negative_stock","current_state":"MISSING; no unresolved V1 decision.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NEG-03', 'NEG-03', 'Negative available stock is blocked by default; finalization revalidates server-side; lot/serial inventory cannot logically go negative. Future exceptions are deferred and are not part of V1.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"negative_stock","current_state":"MISSING; no unresolved V1 decision.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NEG-04', 'NEG-04', 'Negative available stock is blocked by default; finalization revalidates server-side; lot/serial inventory cannot logically go negative. Future exceptions are deferred and are not part of V1.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"negative_stock","current_state":"MISSING; no unresolved V1 decision.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NRV-01', 'NRV-01', 'Inventory records NRV/write-down assessment facts including quantity/value, reason, effective date and evidence; reversals remain auditable; Inventory does not invent financial-account mappings; Ledger owns formal journals and accountant UAT is required for final statutory acceptance claims.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"nrv_write_down_facts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NRV-02', 'NRV-02', 'Inventory records NRV/write-down assessment facts including quantity/value, reason, effective date and evidence; reversals remain auditable; Inventory does not invent financial-account mappings; Ledger owns formal journals and accountant UAT is required for final statutory acceptance claims.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"nrv_write_down_facts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NRV-03', 'NRV-03', 'Inventory records NRV/write-down assessment facts including quantity/value, reason, effective date and evidence; reversals remain auditable; Inventory does not invent financial-account mappings; Ledger owns formal journals and accountant UAT is required for final statutory acceptance claims.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"nrv_write_down_facts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NRV-04', 'NRV-04', 'Inventory records NRV/write-down assessment facts including quantity/value, reason, effective date and evidence; reversals remain auditable; Inventory does not invent financial-account mappings; Ledger owns formal journals and accountant UAT is required for final statutory acceptance claims.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"nrv_write_down_facts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NRV-05', 'NRV-05', 'Inventory records NRV/write-down assessment facts including quantity/value, reason, effective date and evidence; reversals remain auditable; Inventory does not invent financial-account mappings; Ledger owns formal journals and accountant UAT is required for final statutory acceptance claims.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"nrv_write_down_facts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'NRV-06', 'NRV-06', 'Inventory records NRV/write-down assessment facts including quantity/value, reason, effective date and evidence; reversals remain auditable; Inventory does not invent financial-account mappings; Ledger owns formal journals and accountant UAT is required for final statutory acceptance claims.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"nrv_write_down_facts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'OPEN-01', 'OPEN-01', 'Opening inventory creates explicit movement/cost history, validates quantity/location/UOM/tracking/cost data and is retry-safe; introducing opening stock after normal activity requires controlled policy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"opening_inventory","current_state":"MISSING; OPEN-07 requires IS-D09.","blocking_decision_ids":["IS-D09"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'OPEN-02', 'OPEN-02', 'Opening inventory creates explicit movement/cost history, validates quantity/location/UOM/tracking/cost data and is retry-safe; introducing opening stock after normal activity requires controlled policy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"opening_inventory","current_state":"MISSING; OPEN-07 requires IS-D09.","blocking_decision_ids":["IS-D09"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'OPEN-03', 'OPEN-03', 'Opening inventory creates explicit movement/cost history, validates quantity/location/UOM/tracking/cost data and is retry-safe; introducing opening stock after normal activity requires controlled policy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"opening_inventory","current_state":"MISSING; OPEN-07 requires IS-D09.","blocking_decision_ids":["IS-D09"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'OPEN-04', 'OPEN-04', 'Opening inventory creates explicit movement/cost history, validates quantity/location/UOM/tracking/cost data and is retry-safe; introducing opening stock after normal activity requires controlled policy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"opening_inventory","current_state":"MISSING; OPEN-07 requires IS-D09.","blocking_decision_ids":["IS-D09"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'OPEN-05', 'OPEN-05', 'Opening inventory creates explicit movement/cost history, validates quantity/location/UOM/tracking/cost data and is retry-safe; introducing opening stock after normal activity requires controlled policy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"opening_inventory","current_state":"MISSING; OPEN-07 requires IS-D09.","blocking_decision_ids":["IS-D09"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'OPEN-06', 'OPEN-06', 'Opening inventory creates explicit movement/cost history, validates quantity/location/UOM/tracking/cost data and is retry-safe; introducing opening stock after normal activity requires controlled policy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"opening_inventory","current_state":"MISSING; OPEN-07 requires IS-D09.","blocking_decision_ids":["IS-D09"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'OPEN-07', 'OPEN-07', 'Opening inventory creates explicit movement/cost history, validates quantity/location/UOM/tracking/cost data and is retry-safe; introducing opening stock after normal activity requires controlled policy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"opening_inventory","current_state":"MISSING; OPEN-07 requires IS-D09.","blocking_decision_ids":["IS-D09"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'PERF-01', 'PERF-01', 'Balance queries avoid full-ledger scans; use indexed/rebuildable projections, server-side pagination/filter/sort, avoid N+1, prioritize concurrency safety and provide reconciliation/rebuild strategy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"performance","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'PERF-02', 'PERF-02', 'Balance queries avoid full-ledger scans; use indexed/rebuildable projections, server-side pagination/filter/sort, avoid N+1, prioritize concurrency safety and provide reconciliation/rebuild strategy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"performance","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'PERF-03', 'PERF-03', 'Balance queries avoid full-ledger scans; use indexed/rebuildable projections, server-side pagination/filter/sort, avoid N+1, prioritize concurrency safety and provide reconciliation/rebuild strategy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"performance","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'PERF-04', 'PERF-04', 'Balance queries avoid full-ledger scans; use indexed/rebuildable projections, server-side pagination/filter/sort, avoid N+1, prioritize concurrency safety and provide reconciliation/rebuild strategy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"performance","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'PERF-05', 'PERF-05', 'Balance queries avoid full-ledger scans; use indexed/rebuildable projections, server-side pagination/filter/sort, avoid N+1, prioritize concurrency safety and provide reconciliation/rebuild strategy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"performance","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'PERF-06', 'PERF-06', 'Balance queries avoid full-ledger scans; use indexed/rebuildable projections, server-side pagination/filter/sort, avoid N+1, prioritize concurrency safety and provide reconciliation/rebuild strategy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"performance","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'PERF-07', 'PERF-07', 'Balance queries avoid full-ledger scans; use indexed/rebuildable projections, server-side pagination/filter/sort, avoid N+1, prioritize concurrency safety and provide reconciliation/rebuild strategy.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"performance","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-01', 'RECV-01', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-02', 'RECV-02', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-03', 'RECV-03', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-04', 'RECV-04', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-05', 'RECV-05', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-06', 'RECV-06', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-07', 'RECV-07', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-08', 'RECV-08', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-09', 'RECV-09', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RECV-10', 'RECV-10', 'Manual warehouse receipts independent of Purchase with external references, partial receipt, tracking/UOM/cost inputs, atomic stock/cost effects, idempotency, failure atomicity and reversal/correction.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"receipts","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-01', 'REP-01', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-02', 'REP-02', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-03', 'REP-03', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-04', 'REP-04', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-05', 'REP-05', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-06', 'REP-06', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-07', 'REP-07', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-08', 'REP-08', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-09', 'REP-09', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'REP-10', 'REP-10', 'Reorder point/minimum, target/maximum, quantity/multiple, lead time, safety stock and explainable replenishment suggestions based on authoritative projected/available stock without silently creating purchase records.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"replenishment","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-01', 'RES-01', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-02', 'RES-02', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-03', 'RES-03', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-04', 'RES-04', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-05', 'RES-05', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-06', 'RES-06', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-07', 'RES-07', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-08', 'RES-08', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-09', 'RES-09', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-10', 'RES-10', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-11', 'RES-11', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RES-12', 'RES-12', 'First-class reservations do not change physical on-hand, reduce available stock, support release/consumption/expiry/cancellation and external references, and are atomic, concurrent-safe, idempotent and tracking-aware.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reservations","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-01', 'RPT-01', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-02', 'RPT-02', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-03', 'RPT-03', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-04', 'RPT-04', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-05', 'RPT-05', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-06', 'RPT-06', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-07', 'RPT-07', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-08', 'RPT-08', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-09', 'RPT-09', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-10', 'RPT-10', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-11', 'RPT-11', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-12', 'RPT-12', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-13', 'RPT-13', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-14', 'RPT-14', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-15', 'RPT-15', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'RPT-16', 'RPT-16', 'Current stock, warehouse/location stock, Kardex, as-of valuation, traceability, expiry, aging, stock shortages, reserved/available, transit, count variance, adjustments, replenishment and evidence-based slow/non-moving reports with authorization and authoritative valuation.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"reporting","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-01', 'SAFE-01', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-02', 'SAFE-02', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-03', 'SAFE-03', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-04', 'SAFE-04', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-05', 'SAFE-05', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-06', 'SAFE-06', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-07', 'SAFE-07', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-08', 'SAFE-08', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-09', 'SAFE-09', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-10', 'SAFE-10', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-11', 'SAFE-11', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-12', 'SAFE-12', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-13', 'SAFE-13', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-14', 'SAFE-14', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-15', 'SAFE-15', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SAFE-16', 'SAFE-16', 'Server/database-side authorization, RLS, cross-tenant denial, protected SQL helpers, safe search paths, invariant-safe writes, immutable history, reversal correction, idempotency, failure atomicity, warehouse scope, no client authority, no browser secrets, no hosted test resets and full security scenarios.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"audit_security","current_state":"MISSING across business domains.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-01', 'SCOPE-01', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-02', 'SCOPE-02', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-03', 'SCOPE-03', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-04', 'SCOPE-04', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-05', 'SCOPE-05', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-06', 'SCOPE-06', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-07', 'SCOPE-07', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-08', 'SCOPE-08', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-09', 'SCOPE-09', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-10', 'SCOPE-10', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-11', 'SCOPE-11', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'SCOPE-12', 'SCOPE-12', 'Inventory Suit is a standalone multi-tenant product with DB/RLS isolation and independent Supabase/Auth; it must not directly access Shop/Ledger databases or application internals. Future integration uses explicit contracts. MRP, Sales/POS, full purchasing/AP, GL journals and advanced AI/robotics/RFID are outside V1.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"scope","current_state":"SCOPE-05 and SCOPE-06 are implemented; SCOPE-08..SCOPE-12 are implemented as scope constraints; SCOPE-01, SCOPE-04 and SCOPE-07 are partially implemented by bootstrap; SCOPE-02 and SCOPE-03 remain missing.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'STATUS-01', 'STATUS-01', 'Released, quarantine/hold, damaged, expired, blocked and scrap/disposed stock states; non-pickable states are excluded from availability, transitions are authorized/audited and do not silently alter quantity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_status_quality_hold","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'STATUS-02', 'STATUS-02', 'Released, quarantine/hold, damaged, expired, blocked and scrap/disposed stock states; non-pickable states are excluded from availability, transitions are authorized/audited and do not silently alter quantity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_status_quality_hold","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'STATUS-03', 'STATUS-03', 'Released, quarantine/hold, damaged, expired, blocked and scrap/disposed stock states; non-pickable states are excluded from availability, transitions are authorized/audited and do not silently alter quantity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_status_quality_hold","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'STATUS-04', 'STATUS-04', 'Released, quarantine/hold, damaged, expired, blocked and scrap/disposed stock states; non-pickable states are excluded from availability, transitions are authorized/audited and do not silently alter quantity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_status_quality_hold","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'STATUS-05', 'STATUS-05', 'Released, quarantine/hold, damaged, expired, blocked and scrap/disposed stock states; non-pickable states are excluded from availability, transitions are authorized/audited and do not silently alter quantity.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"stock_status_quality_hold","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-01', 'TEN-01', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-02', 'TEN-02', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-03', 'TEN-03', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-04', 'TEN-04', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-05', 'TEN-05', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-06', 'TEN-06', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-07', 'TEN-07', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-08', 'TEN-08', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-09', 'TEN-09', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TEN-10', 'TEN-10', 'Authoritative tenant membership, tenant scoping, cross-tenant denial, organization onboarding, suspended access, server-side capabilities, warehouse scope, sensitive-cache clearing and isolated Inventory Auth/session configuration.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tenant_identity_authorization","current_state":"MISSING; TEN-06..TEN-08 require IS-D01 for final acceptance.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-01', 'TRACK-01', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-02', 'TRACK-02', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-03', 'TRACK-03', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-04', 'TRACK-04', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-05', 'TRACK-05', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-06', 'TRACK-06', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-07', 'TRACK-07', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-08', 'TRACK-08', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-09', 'TRACK-09', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-10', 'TRACK-10', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-11', 'TRACK-11', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-12', 'TRACK-12', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-13', 'TRACK-13', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRACK-14', 'TRACK-14', 'Tracking modes none, lot, serial, expiry and lot_and_expiry; lot/serial identities, manufacturing/best-before/expiry dates, uniqueness, traceability and immutable finalized tracking history.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"tracking","current_state":"MISSING; post-history tracking-mode transition acceptance requires IS-D03.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-01', 'TRF-01', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-02', 'TRF-02', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-03', 'TRF-03', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-04', 'TRF-04', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-05', 'TRF-05', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-06', 'TRF-06', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-07', 'TRF-07', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-08', 'TRF-08', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-09', 'TRF-09', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-10', 'TRF-10', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-11', 'TRF-11', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'TRF-12', 'TRF-12', 'Intra-warehouse and inter-warehouse transfers, direct or shipped/in-transit/received, with partial receipt, tracked dimensions, ownership preservation, traceable transit and explicit shortage/damage disposition.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"transfers","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-01', 'UI-01', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-02', 'UI-02', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-03', 'UI-03', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-04', 'UI-04', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-05', 'UI-05', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-06', 'UI-06', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-07', 'UI-07', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-08', 'UI-08', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-09', 'UI-09', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-10', 'UI-10', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-11', 'UI-11', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-12', 'UI-12', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-13', 'UI-13', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-14', 'UI-14', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-15', 'UI-15', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UI-16', 'UI-16', 'English/Arabic, LTR/RTL, light/dark, responsive behavior, keyboard/focus accessibility, loading/empty/error/permission states, dirty-form protection, shared data-table/query patterns and consistent overlays.', 'partial', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"ui_ux_localization","current_state":"UI-01..UI-07 PARTIALLY IMPLEMENTED by bootstrap; UI-08..UI-16 remain MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-01', 'UOM-01', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-02', 'UOM-02', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-03', 'UOM-03', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-04', 'UOM-04', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-05', 'UOM-05', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-06', 'UOM-06', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-07', 'UOM-07', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'UOM-08', 'UOM-08', 'Canonical and alternate UOMs, deterministic exact-decimal conversion, authoritative base-UOM normalization while preserving entered values, dimensional safety, history safety and ETA UOM mapping.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"units_of_measure","current_state":"MISSING; UOM-07 requires IS-D03. IS-D02 does not block alternate UOMs or exact-decimal arithmetic.","blocking_decision_ids":["IS-D03"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-01', 'VAL-01', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-02', 'VAL-02', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-03', 'VAL-03', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-04', 'VAL-04', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-05', 'VAL-05', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-06', 'VAL-06', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-07', 'VAL-07', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'VAL-08', 'VAL-08', 'Reconcile stock projections and valuation history, detect invalid movement references, impossible serial state and inconsistent availability, carry correlation/idempotency metadata, diagnose failures without secrets and support cross-Suit reconciliation without shared databases.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"observability_reconciliation","current_state":"MISSING.","blocking_decision_ids":[],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'WH-01', 'WH-01', 'Multiple stable warehouses per tenant with code/name/address/timezone, archive lifecycle, history preservation and warehouse-scoped authorization.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"warehouses","current_state":"MISSING.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'WH-02', 'WH-02', 'Multiple stable warehouses per tenant with code/name/address/timezone, archive lifecycle, history preservation and warehouse-scoped authorization.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"warehouses","current_state":"MISSING.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'WH-03', 'WH-03', 'Multiple stable warehouses per tenant with code/name/address/timezone, archive lifecycle, history preservation and warehouse-scoped authorization.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"warehouses","current_state":"MISSING.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'WH-04', 'WH-04', 'Multiple stable warehouses per tenant with code/name/address/timezone, archive lifecycle, history preservation and warehouse-scoped authorization.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"warehouses","current_state":"MISSING.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'WH-05', 'WH-05', 'Multiple stable warehouses per tenant with code/name/address/timezone, archive lifecycle, history preservation and warehouse-scoped authorization.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"warehouses","current_state":"MISSING.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'WH-06', 'WH-06', 'Multiple stable warehouses per tenant with code/name/address/timezone, archive lifecycle, history preservation and warehouse-scoped authorization.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"warehouses","current_state":"MISSING.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;
INSERT INTO control.requirements
(suit_slug, requirement_id, title, summary, status, risk_level, source_path, source_anchor, metadata)
VALUES ('inventory-suit', 'WH-07', 'WH-07', 'Multiple stable warehouses per tenant with code/name/address/timezone, archive lifecycle, history preservation and warehouse-scoped authorization.', 'missing', 'normal', 'handoff:inventory-suit.json', NULL, '{"group":"warehouses","current_state":"MISSING.","blocking_decision_ids":["IS-D01"],"source_kind":"handoff_requirement"}'::jsonb)
ON CONFLICT (suit_slug, requirement_id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  status = EXCLUDED.status,
  risk_level = EXCLUDED.risk_level,
  source_path = EXCLUDED.source_path,
  source_anchor = EXCLUDED.source_anchor,
  metadata = control.requirements.metadata || EXCLUDED.metadata;

-- Decisions. Open decisions are approved for implementation under delegated product-owner authority.
-- External/accountant acceptance requirements are preserved in decision metadata and final acceptance tasks.
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D01', 'V2-D01', 'Each Control account has exactly one customer/supplier binding; generic posting is forbidden; exceptional Control Adjustments require privilege, reason, reference and audit; reconciliation must be zero or explicitly explained; binding/role is immutable after history and replacement is archive-and-create.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved_for_implementation","original_text":"Each Control account has exactly one customer/supplier binding; generic posting is forbidden; exceptional Control Adjustments require privilege, reason, reference and audit; reconciliation must be zero or explicitly explained; binding/role is immutable after history and replacement is archive-and-create.","source_record":{"decision_id":"V2-D01","status":"approved_for_implementation","summary":"Each Control account has exactly one customer/supplier binding; generic posting is forbidden; exceptional Control Adjustments require privilege, reason, reference and audit; reconciliation must be zero or explicitly explained; binding/role is immutable after history and replacement is archive-and-create.","requirements":["COA-02","COA-04","COA-06","COA-09","AR-01","AR-08","AP-01","AP-08"],"notes":"Implemented at contract level in V2-IMP-005. Product-owner approval only; real AR/AP providers and accountant UAT remain pending."},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D02', 'V2-D02', 'Opening migration supports Year Start and Midyear; exact DR=CR; no plug; Year Start Revenue/Expense must be zero; Midyear preserves actual YTD P&L; posted batches are immutable/unique; privileged approval does not require a second user; corrections use linked reversal/adjustment.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved_for_implementation","original_text":"Opening migration supports Year Start and Midyear; exact DR=CR; no plug; Year Start Revenue/Expense must be zero; Midyear preserves actual YTD P&L; posted batches are immutable/unique; privileged approval does not require a second user; corrections use linked reversal/adjustment.","source_record":{"decision_id":"V2-D02","status":"approved_for_implementation","summary":"Opening migration supports Year Start and Midyear; exact DR=CR; no plug; Year Start Revenue/Expense must be zero; Midyear preserves actual YTD P&L; posted batches are immutable/unique; privileged approval does not require a second user; corrections use linked reversal/adjustment.","requirements":["OPEN-01","OPEN-02","OPEN-03","OPEN-04","OPEN-05","OPEN-06","OPEN-07","OPEN-08"],"notes":"Implemented in V2-IMP-006."},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D03', 'V2-D03', 'Use organization + fiscal-year sequential journal numbers assigned only at final successful posting. Format JRN-{FY}-{000001}. Gaps are allowed, numbers are never reused, and rollback/retry must not create a second posted journal. Existing legacy journals keep their historical reference and are not renumbered.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Final journal numbering still needs organization/fiscal-year scope, assignment moment, format, rollback-gap policy, reuse prohibition and legacy presentation.","source_record":{"decision_id":"V2-D03","status":"open","summary":"Final journal numbering still needs organization/fiscal-year scope, assignment moment, format, rollback-gap policy, reuse prohibition and legacy presentation.","requirements":["JRN-02","JRN-03"],"blocks":["full final accounting acceptance"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D04', 'V2-D04', 'Versioned effective-dated statement mappings; visible Unclassified; current/non-current Balance Sheet and Contra handling; indirect Cash Flow; Operating/Investing/Financing classification at account/entry/allocation level; no dominant-counterpart heuristic; split journals explicit/auditable; historical context preserved.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved_for_implementation","original_text":"Versioned effective-dated statement mappings; visible Unclassified; current/non-current Balance Sheet and Contra handling; indirect Cash Flow; Operating/Investing/Financing classification at account/entry/allocation level; no dominant-counterpart heuristic; split journals explicit/auditable; historical context preserved.","source_record":{"decision_id":"V2-D04","status":"approved_for_implementation","summary":"Versioned effective-dated statement mappings; visible Unclassified; current/non-current Balance Sheet and Contra handling; indirect Cash Flow; Operating/Investing/Financing classification at account/entry/allocation level; no dominant-counterpart heuristic; split journals explicit/auditable; historical context preserved.","requirements":["COA-07","FS-01","FS-03","FS-04","FS-07","FS-08"],"notes":"Implemented in V2-IMP-007. Product-owner implementation approval only; accountant mapping/layout/UAT acceptance remains pending."},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D05', 'V2-D05', 'Recognize receivables when an invoice/accounting obligation is issued. One receipt may allocate to multiple invoices and one invoice may receive multiple receipts. Receipts must be fully allocated at creation; unallocated receipts are not supported in V2. Reject overpayments above authoritative outstanding balance. Credits use linked immutable credit/correction records. Write-offs/adjustments require a dedicated privileged reasoned path. Reversals are append-only and reverse allocations/accounting effects without deleting originals.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Receivables policy: recognition timing, allocation cardinality, credits, unallocated receipts, overpayments, write-offs/adjustments and reversed-allocation behavior.","source_record":{"decision_id":"V2-D05","status":"open","summary":"Receivables policy: recognition timing, allocation cardinality, credits, unallocated receipts, overpayments, write-offs/adjustments and reversed-allocation behavior.","requirements":["AR-01","AR-02","AR-03","AR-04","AR-05","AR-06","AR-07","AR-08","AR-09"],"blocks":["V2-IMP-008"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D06', 'V2-D06', 'Recognize payables when a supplier bill is issued/approved, posting the approved expense or asset exactly once. One payment may allocate to multiple bills and one bill may receive multiple payments. Payments must be fully allocated; reject overpayments above authoritative outstanding balance. Supplier credits use linked immutable credit/correction records. Reversals are append-only and restore payable without deleting original payments or bills.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Payables policy: recognition timing, allocation cardinality, supplier credits, unallocated payments, overpayments, expense-vs-asset bills and reversed-allocation behavior.","source_record":{"decision_id":"V2-D06","status":"open","summary":"Payables policy: recognition timing, allocation cardinality, supplier credits, unallocated payments, overpayments, expense-vs-asset bills and reversed-allocation behavior.","requirements":["AP-01","AP-02","AP-03","AP-04","AP-05","AP-06","AP-07","AP-08","AP-09"],"blocks":["V2-IMP-009"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D07', 'V2-D07', 'Configurable fiscal year; Soft Closed blocks normal posting but permits privileged reasoned adjustments; Hard Closed blocks all posting; reopening is privileged/reasoned/audited with Hard→Soft first; year-end posts Retained Earnings while preserving historical P&L.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved_for_implementation","original_text":"Configurable fiscal year; Soft Closed blocks normal posting but permits privileged reasoned adjustments; Hard Closed blocks all posting; reopening is privileged/reasoned/audited with Hard→Soft first; year-end posts Retained Earnings while preserving historical P&L.","source_record":{"decision_id":"V2-D07","status":"approved_for_implementation","summary":"Configurable fiscal year; Soft Closed blocks normal posting but permits privileged reasoned adjustments; Hard Closed blocks all posting; reopening is privileged/reasoned/audited with Hard→Soft first; year-end posts Retained Earnings while preserving historical P&L.","requirements":["CORE-05","JRN-08","PER-01","PER-02","PER-03","PER-04","PER-05","PER-06","PER-07","PER-08"],"notes":"Implemented in V2-IMP-004."},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D08', 'V2-D08', 'Bank matching supports one-to-one, one-to-many and many-to-one when the selected totals reconcile exactly in the same currency. Do not hide differences behind automatic tolerance; differences require an explicit accounting adjustment. Matching existing ledger transactions never reposts them. Internal transfers remain transfer-linked, not income/expense. Unmatch/correction is allowed before completion; completed reconciliations are immutable unless privileged reopening records a reason and audit trail. Outstanding items remain explicit in the reconciliation equation.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Bank matching policy: tolerances, one-to-many/many-to-one, transfers, unmatch/correction, completion/reopening and outstanding-item treatment.","source_record":{"decision_id":"V2-D08","status":"open","summary":"Bank matching policy: tolerances, one-to-many/many-to-one, transfers, unmatch/correction, completion/reopening and outstanding-item treatment.","requirements":["BANK-01","BANK-02","BANK-03","BANK-04","BANK-05","BANK-06","BANK-07","BANK-08"],"blocks":["V2-IMP-010"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D09', 'V2-D09', 'Support straight-line and declining-balance depreciation, with straight-line as default. Capitalization starts when the asset is placed in service. Proration is daily from the in-service/disposal dates. Residual value, useful life and method changes are prospective from the next open period with audit evidence. Impairment is an explicit adjustment. Disposal clears cost and accumulated depreciation and posts proceeds plus gain/loss. Corrections use linked reversal/replacement rather than rewriting history.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Fixed-asset policy: depreciation methods, proration/conventions, capitalization date, residual/useful-life changes, impairment, disposal and correction behavior.","source_record":{"decision_id":"V2-D09","status":"open","summary":"Fixed-asset policy: depreciation methods, proration/conventions, capitalization date, residual/useful-life changes, impairment, disposal and correction behavior.","requirements":["FA-01","FA-02","FA-03","FA-04","FA-05","FA-06","FA-07","FA-08","FA-09"],"blocks":["V2-IMP-011"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D10', 'V2-D10', 'Dimensions are configured per accounting context as optional or required. A journal line may use one or multiple allocations; when multiple allocations are used they must reconcile exactly to the line amount. Inactive values cannot be used on new postings but remain valid historical references. Posted dimensions are not retroactively rewritten. Reporting always exposes an explicit Unassigned bucket so grouped totals reconcile to the unfiltered ledger.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Accounting-dimension policy: required/optional applicability, multi-allocation cardinality, inactive values, retroactive changes and explicit Unassigned treatment.","source_record":{"decision_id":"V2-D10","status":"open","summary":"Accounting-dimension policy: required/optional applicability, multi-allocation cardinality, inactive values, retroactive changes and explicit Unassigned treatment.","requirements":["DIM-01","DIM-02","DIM-03","DIM-04","DIM-05","DIM-06"],"blocks":["V2-IMP-012"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D11', 'V2-D11', 'Initial tax/VAT implementation is scoped to Egypt only, uses effective-dated configuration and must not hard-code rates or claim compliance without dated authoritative regulatory evidence. Rounding occurs only at explicitly defined tax/document boundaries using the document currency minor unit. Tax points, rates, exemptions, adjustments and report scope must come from verified authoritative sources before runtime implementation. External filing/e-invoicing submission remains out of scope unless separately authorized.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Tax/VAT jurisdiction and business scope, current rates/rules, rounding, tax points, adjustments, document/report scope and external-compliance boundaries.","source_record":{"decision_id":"V2-D11","status":"open","summary":"Tax/VAT jurisdiction and business scope, current rates/rules, rounding, tax points, adjustments, document/report scope and external-compliance boundaries.","requirements":["TAX-01","TAX-02","TAX-03","TAX-04","TAX-05","TAX-06","TAX-07"],"blocks":["V2-IMP-013"],"required_approver":"accountant + product owner plus dated authoritative regulatory verification"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true,"authoritative_regulatory_evidence_required":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D12', 'V2-D12', 'When Inventory Suit is connected, its versioned movement/valuation facts are the inventory accounting source of truth and Ledger must not recalculate operational stock valuation. Inventory Control/COGS mappings are configurable in Ledger. Negative stock is not accepted as an accounting source. Returns, backdating, corrections and revaluations arrive as explicit versioned/compensating facts and are posted idempotently. Ledger does not implement WMS/procurement behavior.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Inventory accounting policy: movement source of truth, Control accounts, costing/valuation method, negative stock, returns, backdating, corrections and revaluation.","source_record":{"decision_id":"V2-D12","status":"open","summary":"Inventory accounting policy: movement source of truth, Control accounts, costing/valuation method, negative stock, returns, backdating, corrections and revaluation.","requirements":["INV-01","INV-02","INV-03","INV-04","INV-05","INV-06","INV-07"],"blocks":["V2-IMP-014"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('ledger-suit', 'V2-D13', 'V2-D13', 'Foreign-currency AR/AP settlement and realized/unrealized FX revaluation are out of scope for Accounting V2. AR/AP obligations settle in the organization base currency. Preserve existing transaction-currency support where already valid, but do not extend it into multi-currency receivables/payables without a future explicit task.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Whether AR/AP obligations support foreign-currency settlement and realized/unrealized FX/revaluation. Do not infer this from existing transaction currency support.","source_record":{"decision_id":"V2-D13","status":"open","optional":true,"summary":"Whether AR/AP obligations support foreign-currency settlement and realized/unrealized FX/revaluation. Do not infer this from existing transaction currency support.","requirements":["CORE-07","AR-01","AR-02","AR-03","AR-04","AR-05","AR-06","AR-07","AR-08","AR-09","AP-01","AP-02","AP-03","AP-04","AP-05","AP-06","AP-07","AP-08","AP-09"],"blocks":["V2-IMP-008 only if multi-currency AR/AP is selected","V2-IMP-009 only if multi-currency AR/AP is selected"],"required_approver":"accountant + product owner"},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24","implementation_approval_only":true,"accountant_acceptance_pending":true}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'ARCH-D01', 'ARCH-D01', 'Shop Suit remains standalone and independently subscribable. Ledger Suit/ERP integration is optional future work and must not be a runtime dependency.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Shop Suit remains standalone and independently subscribable. Ledger Suit/ERP integration is optional future work and must not be a runtime dependency.","source_record":{"decision_id":"ARCH-D01","status":"approved","decision":"Shop Suit remains standalone and independently subscribable. Ledger Suit/ERP integration is optional future work and must not be a runtime dependency.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'BIZ-D01', 'BIZ-D01', 'One Shop Suit product supports product/stock, service-only, and mixed businesses. Business mode is operational configuration, not subscription tiering.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"One Shop Suit product supports product/stock, service-only, and mixed businesses. Business mode is operational configuration, not subscription tiering.","source_record":{"decision_id":"BIZ-D01","status":"approved","decision":"One Shop Suit product supports product/stock, service-only, and mixed businesses. Business mode is operational configuration, not subscription tiering.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'INV-D01', 'INV-D01', 'Preserve the verified FIFO inventory costing behavior. Do not change costing policy without a separate explicit decision and reconciliation plan.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Preserve the verified FIFO inventory costing behavior. Do not change costing policy without a separate explicit decision and reconciliation plan.","source_record":{"decision_id":"INV-D01","status":"approved","decision":"Preserve the verified FIFO inventory costing behavior. Do not change costing policy without a separate explicit decision and reconciliation plan.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'INV-D02', 'INV-D02', 'Negative stock remains prohibited in supported workflows unless a future explicit policy approves otherwise.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Negative stock remains prohibited in supported workflows unless a future explicit policy approves otherwise.","source_record":{"decision_id":"INV-D02","status":"approved","decision":"Negative stock remains prohibited in supported workflows unless a future explicit policy approves otherwise.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PAY-D01', 'PAY-D01', 'Reject customer overpayments above authoritative invoice outstanding balance. Do not create customer credit or leave excess unallocated.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Reject customer overpayments above authoritative invoice outstanding balance. Do not create customer credit or leave excess unallocated.","source_record":{"decision_id":"PAY-D01","status":"approved","decision":"Reject customer overpayments above authoritative invoice outstanding balance. Do not create customer credit or leave excess unallocated.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PAY-D02', 'PAY-D02', 'Customer receipts must be fully allocated immediately. Unallocated customer receipts are not allowed.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Customer receipts must be fully allocated immediately. Unallocated customer receipts are not allowed.","source_record":{"decision_id":"PAY-D02","status":"approved","decision":"Customer receipts must be fully allocated immediately. Unallocated customer receipts are not allowed.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PAY-D03', 'PAY-D03', 'Original payments are immutable. Reversal is an append-only non-money correction; refund is a separate traceable outbound event. Both partial and full reversal/refund are supported.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Original payments are immutable. Reversal is an append-only non-money correction; refund is a separate traceable outbound event. Both partial and full reversal/refund are supported.","source_record":{"decision_id":"PAY-D03","status":"approved","decision":"Original payments are immutable. Reversal is an append-only non-money correction; refund is a separate traceable outbound event. Both partial and full reversal/refund are supported.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PAY-D04', 'PAY-D04', 'A customerless sale is allowed only when fully paid atomically at checkout. Any outstanding/credit sale requires a customer. Customerless refund/reversal that would create anonymous outstanding remains deferred until sale correction can adjust the sale atomically.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"A customerless sale is allowed only when fully paid atomically at checkout. Any outstanding/credit sale requires a customer. Customerless refund/reversal that would create anonymous outstanding remains deferred until sale correction can adjust the sale atomically.","source_record":{"decision_id":"PAY-D04","status":"approved","decision":"A customerless sale is allowed only when fully paid atomically at checkout. Any outstanding/credit sale requires a customer. Customerless refund/reversal that would create anonymous outstanding remains deferred until sale correction can adjust the sale atomically.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'GIT-D01', 'GIT-D01', 'Use app-specific stacked PRs. Each app may have one root PR into stg; subsequent tasks branch from and target the latest same-app stack leaf. Shop Suit must never stack on Ledger Suit.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Use app-specific stacked PRs. Each app may have one root PR into stg; subsequent tasks branch from and target the latest same-app stack leaf. Shop Suit must never stack on Ledger Suit.","source_record":{"decision_id":"GIT-D01","status":"approved","decision":"Use app-specific stacked PRs. Each app may have one root PR into stg; subsequent tasks branch from and target the latest same-app stack leaf. Shop Suit must never stack on Ledger Suit.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'ENG-D01', 'ENG-D01', 'Use targeted verification for ordinary tasks to conserve tokens. Broad regression/build/browser suites are reserved for milestones, risk-driven cases, and final launch qualification.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Use targeted verification for ordinary tasks to conserve tokens. Broad regression/build/browser suites are reserved for milestones, risk-driven cases, and final launch qualification.","source_record":{"decision_id":"ENG-D01","status":"approved","decision":"Use targeted verification for ordinary tasks to conserve tokens. Broad regression/build/browser suites are reserved for milestones, risk-driven cases, and final launch qualification.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'REL-D01', 'REL-D01', 'No deployment, remote migration, production/customer-data mutation, provider/secret change, or PR merge occurs without separate explicit authorization.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"No deployment, remote migration, production/customer-data mutation, provider/secret change, or PR merge occurs without separate explicit authorization.","source_record":{"decision_id":"REL-D01","status":"approved","decision":"No deployment, remote migration, production/customer-data mutation, provider/secret change, or PR merge occurs without separate explicit authorization.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-DIR-01', 'SUB-DIR-01', 'Subscription architecture should use resource-based plan limits rather than permanently binding product/service/mixed business type to a subscription tier.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"approved","original_text":"Subscription architecture should use resource-based plan limits rather than permanently binding product/service/mixed business type to a subscription tier.","source_record":{"decision_id":"SUB-DIR-01","status":"approved","decision":"Subscription architecture should use resource-based plan limits rather than permanently binding product/service/mixed business type to a subscription tier.","blocking_tasks":[]},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PUR-D01', 'PUR-D01', 'Supplier credits are immutable credit records linked to a supplier and, when applicable, the originating purchase/return. Applying a credit reduces payable without creating cash movement. A stock return owns the stock/value effect; the credit record must not reduce stock again. Credits cannot exceed the eligible remaining purchase/payable amount unless a future explicit supplier-credit-balance feature is approved.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define supplier credit semantics.","source_record":{"decision_id":"PUR-D01","status":"open","decision":"Define supplier credit semantics.","blocking_tasks":["SS-PUR-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PUR-D02', 'PUR-D02', 'A purchase return may reduce stock only for quantity that is still available/owned and traceable to the originating receipt. Quantity already sold, consumed or otherwise unavailable must never be returned as physical stock or drive stock negative. Any financial-only supplier concession for unavailable quantity is represented as a supplier credit with no stock movement. Every return is append-only, linked and idempotent.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define purchase-return behavior when some or all received stock has already been consumed/sold.","source_record":{"decision_id":"PUR-D02","status":"open","decision":"Define purchase-return behavior when some or all received stock has already been consumed/sold.","blocking_tasks":["SS-PUR-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PUR-D03', 'PUR-D03', 'Reject supplier payments above the authoritative outstanding payable in V1. Do not create unallocated supplier credit from overpayment.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define supplier overpayment behavior.","source_record":{"decision_id":"PUR-D03","status":"open","decision":"Define supplier overpayment behavior.","blocking_tasks":["SS-PUR-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'PUR-D04', 'PUR-D04', 'Supplier payments must be fully allocated when created. Unallocated supplier payments are not supported in V1. Original payments are immutable; reversal is an append-only event that restores the affected payable exactly once and preserves actor/date/reference history.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define supplier unallocated-payment and reversed-payment behavior.","source_record":{"decision_id":"PUR-D04","status":"open","decision":"Define supplier unallocated-payment and reversed-payment behavior.","blocking_tasks":["SS-PUR-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SALE-D01', 'SALE-D01', 'Custom/manual sale lines are not part of Shop Suit V1. Sales may contain catalog products and services only. A future explicit decision may add non-catalog lines.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define whether and how approved custom/manual sale lines are supported.","source_record":{"decision_id":"SALE-D01","status":"open","decision":"Define whether and how approved custom/manual sale lines are supported.","blocking_tasks":["SS-SALE-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SALE-D02', 'SALE-D02', 'Tax/VAT calculation and compliance are out of Shop Suit V1. Do not expose tax controls as authoritative, do not make compliance claims, and do not add business tax defaults. Preserve any historical tax-like fields only as legacy data until a separately researched and approved tax scope exists.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define Shop Suit tax/VAT scope and any compliance claims. Existing tax-like fields are not approval.","source_record":{"decision_id":"SALE-D02","status":"open","decision":"Define Shop Suit tax/VAT scope and any compliance claims. Existing tax-like fields are not approval.","blocking_tasks":["SS-SALE-002","SS-SET-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SALE-D03', 'SALE-D03', 'Keep the authoritative V1 sale lifecycle to draft and issued. Void, return, refund and correction are append-only linked correction records/events against an issued sale, not destructive state rewrites or extra mutable lifecycle states.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define any additional supported sale lifecycle states beyond the currently supported draft/issued behavior.","source_record":{"decision_id":"SALE-D03","status":"open","decision":"Define any additional supported sale lifecycle states beyond the currently supported draft/issued behavior.","blocking_tasks":["SS-SALE-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SALE-D04', 'SALE-D04', 'Allow partial returns per original line up to sold quantity minus prior returns. Product returns restore stock exactly once with traceability to original FIFO cost effects; service returns have no stock effect. If the sale is unpaid, the return reduces outstanding. If money was collected, any refund is a separate outbound payment limited to the refundable amount. Repeated requests are idempotent and the original sale remains immutable.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define partial sale-return semantics, including how quantities, payments, refunds and stock restoration interact.","source_record":{"decision_id":"SALE-D04","status":"open","decision":"Define partial sale-return semantics, including how quantities, payments, refunds and stock restoration interact.","blocking_tasks":["SS-SALE-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SERV-D01', 'SERV-D01', 'Include configurable service-material consumption in V1.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Decide whether configurable service material consumption is included in the V1 launch scope.","source_record":{"decision_id":"SERV-D01","status":"open","decision":"Decide whether configurable service material consumption is included in the V1 launch scope.","blocking_tasks":["SS-SERV-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SERV-D02', 'SERV-D02', 'Service material quantities use the stocked product''s canonical base-UOM normalization and exact-decimal conversion rules. Reject quantities that cannot be represented safely; do not silently round inventory consumption. Display rounding is presentation-only.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"If service material consumption is approved, define units and rounding rules for consumed materials.","source_record":{"decision_id":"SERV-D02","status":"open","decision":"If service material consumption is approved, define units and rounding rules for consumed materials.","blocking_tasks":["SS-SERV-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SERV-D03', 'SERV-D03', 'Service-material definitions are versioned. Editing a recipe creates a new effective version for future issued sales. Each issued sale snapshots the exact recipe/material quantities used so later edits never rewrite history.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"If service material consumption is approved, define versioning/edit-effective-date behavior so recipe changes do not rewrite issued history.","source_record":{"decision_id":"SERV-D03","status":"open","decision":"If service material consumption is approved, define versioning/edit-effective-date behavior so recipe changes do not rewrite issued history.","blocking_tasks":["SS-SERV-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'EXP-D01', 'EXP-D01', 'Other operational income/cash-entry workflows are excluded from V1. Complete the expense workflow only.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Decide whether EXP-05/EXP-06 other operational income/cash entries are part of launch scope.","source_record":{"decision_id":"EXP-D01","status":"open","decision":"Decide whether EXP-05/EXP-06 other operational income/cash entries are part of launch scope.","blocking_tasks":["SS-EXP-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'EXP-D02', 'EXP-D02', 'No operational-income categories are introduced in V1. Any future non-sale income feature requires a separate explicit semantics/design decision so sales revenue cannot be duplicated.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"If operational income is approved, define its categories/source semantics so it cannot duplicate sales revenue.","source_record":{"decision_id":"EXP-D02","status":"open","decision":"If operational income is approved, define its categories/source semantics so it cannot duplicate sales revenue.","blocking_tasks":["SS-EXP-002"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'TEAM-D01', 'TEAM-D01', 'Provide default role templates Owner, Manager, Sales/Cashier, Inventory, Purchasing and Viewer/Auditor. Templates are convenience only; granular backend capabilities remain authoritative and administrators may compose allowed capabilities without exceeding their own authority.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve the initial staff role catalog / role templates while retaining granular backend permissions.","source_record":{"decision_id":"TEAM-D01","status":"open","decision":"Approve the initial staff role catalog / role templates while retaining granular backend permissions.","blocking_tasks":["SS-TEAM-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'TEAM-D02', 'TEAM-D02', 'Staff invitations expire after 7 days, are single-use, revocable, and bound to the target shop, invited identity and intended role/capability grant.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define staff invitation expiry duration/policy.","source_record":{"decision_id":"TEAM-D02","status":"open","decision":"Define staff invitation expiry duration/policy.","blocking_tasks":["SS-TEAM-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'TEAM-D03', 'TEAM-D03', 'Do not enforce a hard staff-seat limit during V1 beta. The entitlement model must support a nullable/configurable seat quota and enforce it atomically only when a plan config supplies one.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define staff seat quotas or explicitly approve no seat quota for the initial plans.","source_record":{"decision_id":"TEAM-D03","status":"open","decision":"Define staff seat quotas or explicitly approve no seat quota for the initial plans.","blocking_tasks":["SS-TEAM-001","SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-D01', 'SUB-D01', 'V1 implements a configurable resource-entitlement catalog rather than hard-coded public commercial tiers. Use internal plan slugs/configuration and keep public display names data-driven so commercial naming can change without code migration.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve final subscription plan names.","source_record":{"decision_id":"SUB-D01","status":"open","decision":"Approve final subscription plan names.","blocking_tasks":["SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-D02', 'SUB-D02', 'Do not hard-code or publicly claim final Shop Suit prices in this implementation. Price fields may be nullable/configurable and billing-provider work remains out of scope. During beta, no automated paid checkout is introduced by this task.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve final plan prices.","source_record":{"decision_id":"SUB-D02","status":"open","decision":"Approve final plan prices.","blocking_tasks":["SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-D03', 'SUB-D03', 'Support a configurable trial duration with 30 days as the default commercial trial value, but allow beta/internal plans to disable automatic trial expiry. Historical data is never deleted when a trial ends.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve final trial duration/terms.","source_record":{"decision_id":"SUB-D03","status":"open","decision":"Approve final trial duration/terms.","blocking_tasks":["SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-D04', 'SUB-D04', 'Resource quotas are data-driven per plan and per resource. During beta the default is unlimited/null unless an explicit configured limit is present. The backend must enforce configured limits atomically; no arbitrary product/business-mode gate is hard-coded.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve resource quotas/limits for each plan.","source_record":{"decision_id":"SUB-D04","status":"open","decision":"Approve resource quotas/limits for each plan.","blocking_tasks":["SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-D05', 'SUB-D05', 'Upgrades take effect immediately after an authorized entitlement change. Downgrades take effect at the next renewal/effective boundary unless an administrator explicitly schedules otherwise. Entitlement changes are audited and cannot be self-granted by clients.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define approved upgrade/downgrade actions and timing.","source_record":{"decision_id":"SUB-D05","status":"open","decision":"Define approved upgrade/downgrade actions and timing.","blocking_tasks":["SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-D06', 'SUB-D06', 'After subscription/trial expiry, preserve read access to historical business data and exports for authorized users, but block new money/stock/business mutations except account/subscription/reactivation actions required to restore service.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define history-read access and write restrictions after subscription expiry.","source_record":{"decision_id":"SUB-D06","status":"open","decision":"Define history-read access and write restrictions after subscription expiry.","blocking_tasks":["SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SUB-D07', 'SUB-D07', 'If a downgrade leaves usage above a configured limit, keep all historical data intact and readable. Block creation of additional over-limit resources until usage falls below the limit or the shop upgrades; never auto-delete or silently archive existing records.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Define behavior when a downgrade leaves existing usage above the new plan limits. Historical data must not be silently archived or deleted.","source_record":{"decision_id":"SUB-D07","status":"open","decision":"Define behavior when a downgrade leaves existing usage above the new plan limits. Historical data must not be silently archived or deleted.","blocking_tasks":["SS-SUB-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SET-D01', 'SET-D01', 'EGP is the default currency. Currency is stored as an ISO-4217 code and Shop Suit performs no implicit FX conversion. The business currency may be changed only before the first finalized monetary document; after financial history exists it is immutable without a future explicit migration workflow.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve supported business currencies and any currency-change restrictions.","source_record":{"decision_id":"SET-D01","status":"open","decision":"Approve supported business currencies and any currency-change restrictions.","blocking_tasks":["SS-SET-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SET-D02', 'SET-D02', 'Invoice/receipt presentation may configure business name/logo/address/contact, document labels, optional footer/notes, language/direction and line-description visibility. Finalized documents snapshot all presentation/business values needed for historical rendering.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve configurable invoice/receipt presentation settings.","source_record":{"decision_id":"SET-D02","status":"open","decision":"Approve configurable invoice/receipt presentation settings.","blocking_tasks":["SS-SET-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'SET-D03', 'SET-D03', 'No business tax defaults are supported in V1 because SALE-D02 excludes tax/VAT scope. Existing legacy fields are not treated as approved defaults.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Approve any business tax defaults only after SALE-D02 tax scope is decided.","source_record":{"decision_id":"SET-D03","status":"open","decision":"Approve any business tax defaults only after SALE-D02 tax scope is decided.","blocking_tasks":["SS-SET-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'INT-D01', 'INT-D01', 'Cross-product SSO is explicitly out of current Shop Suit scope. Shop keeps independent authentication/session behavior.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Cross-product SSO remains a separate future decision and is not part of current Shop Suit implementation.","source_record":{"decision_id":"INT-D01","status":"open","decision":"Cross-product SSO remains a separate future decision and is not part of current Shop Suit implementation.","blocking_tasks":[]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('shop-suit', 'INT-D02', 'INT-D02', 'Do not create Ledger integration queues/tables/events in current Shop implementation. Preserve stable operational IDs and correction links only; a future versioned integration contract must be approved before integration infrastructure is added.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"A concrete future Ledger integration contract, including any queues/tables/events, must be approved before integration infrastructure is added.","source_record":{"decision_id":"INT-D02","status":"open","decision":"A concrete future Ledger integration contract, including any queues/tables/events, must be approved before integration infrastructure is added.","blocking_tasks":[]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D01', 'IS-D01', 'Authorization is capability-driven and deny-by-default. Tenant-wide Owner/Inventory Admin authority may span all warehouses. Other users require both the relevant capability and an explicit warehouse grant for warehouse-scoped actions. Warehouse grants never create capabilities by themselves. Revocation/suspension takes effect immediately for new protected requests, and client-selected tenant/warehouse context never grants authority.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"How are warehouse-scoped capabilities assigned, inherited, revoked, and evaluated alongside tenant-wide capabilities?","source_record":{"decision_id":"IS-D01","status":"open","disposition":"KEEP","question":"How are warehouse-scoped capabilities assigned, inherited, revoked, and evaluated alongside tenant-wide capabilities?","affected_requirement_ids":["TEN-06..TEN-08","SAFE-11"],"blocks":["IS-TEN-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D02', 'IS-D02', 'Use exact-decimal authoritative storage with maximum scales: quantity NUMERIC(24,6), conversion factor NUMERIC(24,12), unit cost NUMERIC(24,8), valuation totals NUMERIC(30,8). Never silently round stock quantities or conversion factors. Preserve full internal precision and round only at explicit business/reporting boundaries using half-up rounding to the configured display/currency scale.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"What maximum authoritative quantity/conversion/unit-cost/valuation scales, rounding mode and business-significant rounding boundaries apply?","source_record":{"decision_id":"IS-D02","status":"open","disposition":"NARROW","question":"What maximum authoritative quantity/conversion/unit-cost/valuation scales, rounding mode and business-significant rounding boundaries apply?","affected_requirement_ids":["UOM-03","UOM-05","COST-04","COST-14"],"blocks":["IS-COST-001"],"notes":"Does not block alternate UOMs, deterministic conversion factors, exact numeric storage or weighted-average implementation. It blocks final COST-14 acceptance."},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D03', 'IS-D03', 'Base UOM and tracking mode may be edited only before the item has finalized stock history. After any finalized movement they are immutable in V1. A structural change requires archiving/replacing the item and a separately controlled migration/transfer process; existing history is never rewritten.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"What controlled workflow is allowed for changing base UOM or tracking mode after stock history exists?","source_record":{"decision_id":"IS-D03","status":"open","disposition":"NARROW","question":"What controlled workflow is allowed for changing base UOM or tracking mode after stock history exists?","affected_requirement_ids":["ITEM-16","UOM-07","applicable TRACK requirements"],"blocks":["IS-ITEM-001","IS-TRACK-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D04', 'IS-D04', 'Default operational removal is FIFO picking for non-expiry inventory and FEFO for expiry-tracked inventory. Manual selection and location-priority/closest strategies remain available as explicit configuration. Inheritance is item override > warehouse default > tenant default. Deterministic ties use expiry date where applicable, then receipt effective timestamp, configured location priority, and stable lot/serial/location identifiers.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"What are the default operational removal strategy, configuration inheritance and deterministic tie-break rules?","source_record":{"decision_id":"IS-D04","status":"open","disposition":"NARROW","question":"What are the default operational removal strategy, configuration inheritance and deterministic tie-break rules?","affected_requirement_ids":["ITEM-15","LOC-12","ISSUE-01..ISSUE-10"],"blocks":["IS-ISSUE-001"],"notes":"Manual, FIFO picking, FEFO and closest/location-priority support are already locked; this decision does not redefine accounting valuation."},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D05', 'IS-D05', 'Reservation concurrency/locking is engineering design constrained by already-locked invariants. Do not reuse this ID.', 'superseded', 'product-owner-chat-delegation', now(), '{"original_status":"retired","original_text":null,"source_record":{"decision_id":"IS-D05","status":"retired","disposition":"REMOVE","question":null,"affected_requirement_ids":[],"blocks":[],"notes":"Reservation concurrency/locking is engineering design constrained by already-locked invariants. Do not reuse this ID."},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D06', 'IS-D06', 'V1 negative-stock policy is already locked. Do not reuse this ID.', 'superseded', 'product-owner-chat-delegation', now(), '{"original_status":"retired","original_text":null,"source_record":{"decision_id":"IS-D06","status":"retired","disposition":"REMOVE","question":null,"affected_requirement_ids":["NEG-01..NEG-04"],"blocks":[],"notes":"V1 negative-stock policy is already locked. Do not reuse this ID."},"resolution_basis":"authoritative_handoff"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D07', 'IS-D07', 'Every stock document has an immutable UUID plus a human-readable reference scoped by tenant, document type and calendar year. Assign the readable sequence at successful finalization, format TYPE-YYYY-000001, allow gaps, never reuse numbers, and never renumber historical documents. Drafts rely on UUID/temp display until finalized.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"If sequential human-readable document references are required, what are their scope, assignment time, format, gap and reuse rules?","source_record":{"decision_id":"IS-D07","status":"open","disposition":"NARROW","question":"If sequential human-readable document references are required, what are their scope, assignment time, format, gap and reuse rules?","affected_requirement_ids":["document identity/numbering group"],"blocks":["IS-STOCK-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D08', 'IS-D08', 'Future Shop-to-Inventory authority cutover is per tenant and requires explicit activation, a zero/explained reconciliation snapshot, fencing of Shop stock writes, migration/opening snapshot, idempotent replay/deduplication, comparison evidence and a single-authority switch. Never allow dual writers. Rollback before final cutover may restore Shop authority; after final cutover use forward/compensating events rather than rewriting history.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"What exact tenant activation, migration, fencing, reconciliation and rollback protocol switches Shop from standalone stock authority to Inventory authority?","source_record":{"decision_id":"IS-D08","status":"open","disposition":"NARROW","question":"What exact tenant activation, migration, fencing, reconciliation and rollback protocol switches Shop from standalone stock authority to Inventory authority?","affected_requirement_ids":["INT-13"],"blocks":[],"notes":"Does not block core IS-INT-001 foundations. Applies to future live Shop cutover."},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D09', 'IS-D09', 'Opening inventory is allowed only before ordinary finalized stock activity for the relevant item/warehouse scope. Once ordinary activity exists, use controlled count/adjustment workflows instead of introducing a new opening balance. Opening imports remain idempotent, reviewed and fully traceable.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"Under what conditions may opening inventory be introduced after ordinary stock activity has begun, and what approval/correction treatment applies?","source_record":{"decision_id":"IS-D09","status":"open","disposition":"NARROW","question":"Under what conditions may opening inventory be introduced after ordinary stock activity has begun, and what approval/correction treatment applies?","affected_requirement_ids":["OPEN-07"],"blocks":["IS-IMP-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D10', 'IS-D10', 'Valuation method is immutable after the first valued stock movement in V1. Do not perform in-place historical revaluation to switch methods. A future dedicated migration may be designed separately; until then use a replacement item/cutover approach with preserved history.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"What controlled migration is allowed when changing valuation method after stock history exists?","source_record":{"decision_id":"IS-D10","status":"open","disposition":"NARROW","question":"What controlled migration is allowed when changing valuation method after stock history exists?","affected_requirement_ids":["COST-11"],"blocks":["IS-COST-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D11', 'IS-D11', 'Ledger consumes versioned Inventory valuation/NRV/write-down/reversal facts through explicit integration events/outbox records, idempotent by stable event ID. Ledger owns account mappings and journal creation; Inventory never posts Ledger journals. Cross-Suit reconciliation must be zero or explicitly explained.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"How will Ledger map and consume Inventory valuation, NRV, write-down, reversal and reconciliation facts as formal journals?","source_record":{"decision_id":"IS-D11","status":"open","disposition":"NARROW","question":"How will Ledger map and consume Inventory valuation, NRV, write-down, reversal and reconciliation facts as formal journals?","affected_requirement_ids":["NRV-04..NRV-06","INT-14"],"blocks":[],"notes":"Future Ledger adapter/mapping decision; it does not block Inventory-side valuation/NRV facts or core integration foundations."},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D12', 'IS-D12', 'Approve the supplied Egyptian Arabic Inventory terminology baseline as the final V1 glossary. Later copy refinements may improve wording but do not block implementation unless they change domain meaning.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open","original_text":"What final reviewed Arabic Inventory glossary/copy refinements are approved beyond the supplied baseline terminology?","source_record":{"decision_id":"IS-D12","status":"open","disposition":"KEEP","question":"What final reviewed Arabic Inventory glossary/copy refinements are approved beyond the supplied baseline terminology?","affected_requirement_ids":["UI-01..UI-16","Egyptian terminology group"],"blocks":["IS-VER-001"]},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D13', 'IS-D13', 'Commercial plans/prices/quotas are deliberately deferred from core V1. Core Inventory implementation must not hard-code commercial entitlements; keep future entitlement configuration separate from authorization.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open_deferred","original_text":"What plans, prices, quotas and commercial entitlements apply?","source_record":{"decision_id":"IS-D13","status":"open_deferred","disposition":"KEEP","question":"What plans, prices, quotas and commercial entitlements apply?","affected_requirement_ids":["commercial/subscription group"],"blocks":[],"notes":"Does not block core V1 implementation."},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;
INSERT INTO control.decisions
(suit_slug, decision_id, title, decision_text, status, source, decided_at, metadata)
VALUES ('inventory-suit', 'IS-D14', 'IS-D14', 'Development remains local-only until explicit hosted Supabase/Vercel/provider identifiers are authorized. Automation must not invent hosted IDs, deploy, mutate hosted databases or change provider settings without separate explicit authorization.', 'approved', 'product-owner-chat-delegation', now(), '{"original_status":"open_deferred","original_text":"Which hosted Supabase organizations/projects, URLs, Vercel projects and provider settings are authorized?","source_record":{"decision_id":"IS-D14","status":"open_deferred","disposition":"KEEP","question":"Which hosted Supabase organizations/projects, URLs, Vercel projects and provider settings are authorized?","affected_requirement_ids":["SCOPE-04","TEN-10"],"blocks":[],"notes":"No hosted IDs may be invented. Does not block local V1 implementation."},"resolution_basis":"product_owner_delegated_chatgpt_recommendation_2026-09-24"}'::jsonb)
ON CONFLICT (suit_slug, decision_id) DO UPDATE SET
  title = EXCLUDED.title,
  decision_text = EXCLUDED.decision_text,
  status = EXCLUDED.status,
  source = EXCLUDED.source,
  decided_at = EXCLUDED.decided_at,
  metadata = control.decisions.metadata || EXCLUDED.metadata;

-- Completed checkpoints plus all remaining implementation tasks.
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'LS-V2-BASELINE-001',
  'ledger-suit',
  10,
  100,
  'Accounting V2 Implementation Baseline',
  'Established the canonical 138-requirement gap analysis, decision register, ordered task graph, and BASELINE.md tracker.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"LS-V2-BASELINE-001","title":"Accounting V2 Implementation Baseline","status":"complete","commit_sha":"e51435c52f8c3d36b4dccd86c1adb731dd2cb2a5","published":true,"notes":"Established the canonical 138-requirement gap analysis, decision register, ordered task graph, and BASELINE.md tracker."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-001',
  'ledger-suit',
  20,
  100,
  'Posting Idempotency Integrity',
  'Payload-bound tenant-scoped idempotency, deterministic conflicts, concurrent retry safety, and exactly-one journal/audit/quota effect.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-IMP-001","title":"Posting Idempotency Integrity","status":"complete","commit_sha":"7bfb37ee7326a4b8ae387dd6783b5f72cfd7a941","published":true,"notes":"Payload-bound tenant-scoped idempotency, deterministic conflicts, concurrent retry safety, and exactly-one journal/audit/quota effect."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-002',
  'ledger-suit',
  30,
  100,
  'Six-Column Trial Balance',
  'Opening DR/CR, Period DR/CR, Closing DR/CR, hierarchy-safe totals, Contra handling, drill-down and export parity.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-IMP-002","title":"Six-Column Trial Balance","status":"complete","commit_sha":"f04f0729f3f5854460d699dbfbb00453691136da","published":true,"notes":"Opening DR/CR, Period DR/CR, Closing DR/CR, hierarchy-safe totals, Contra handling, drill-down and export parity."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-VER-002A',
  'ledger-suit',
  40,
  100,
  'Trial Balance UI, Drill-Down, Localization, and RTL Verification',
  'Executed focused Playwright verification for Trial Balance AC-9 and AC-11 in EN/LTR and AR/RTL.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-VER-002A","title":"Trial Balance UI, Drill-Down, Localization, and RTL Verification","status":"complete","commit_sha":"21f5af8c9c9e42f70600b5e1f63425bd296450b0","published":true,"notes":"Executed focused Playwright verification for Trial Balance AC-9 and AC-11 in EN/LTR and AR/RTL."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-003',
  'ledger-suit',
  50,
  100,
  'Journal Identity and Professional Journal Center',
  'Journal Center, saved views, lines, source/reversal relationships and stable UUID-derived journal reference are complete. Final professional sequential numbering remains a residual requirement gated by V2-D03; do not redo the Journal Center.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-IMP-003","title":"Journal Identity and Professional Journal Center","status":"complete","commit_sha":"94060d78bfe941c8fefca4b2a84d3a957809005c","published":true,"notes":"Journal Center, saved views, lines, source/reversal relationships and stable UUID-derived journal reference are complete. Final professional sequential numbering remains a residual requirement gated by V2-D03; do not redo the Journal Center."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-004',
  'ledger-suit',
  60,
  100,
  'Accounting Periods, Closing, Reopening, and Year-End Close',
  'Open/Soft Closed/Hard Closed periods, audited reopening, configurable fiscal years, close/post serialization, Retained Earnings year-end close and preserved historical P&L.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-IMP-004","title":"Accounting Periods, Closing, Reopening, and Year-End Close","status":"complete","commit_sha":"7bf68b160b1a18b392d181630f45de1baf23b50a","published":true,"notes":"Open/Soft Closed/Hard Closed periods, audited reopening, configurable fiscal years, close/post serialization, Retained Earnings year-end close and preserved historical P&L."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-005',
  'ledger-suit',
  70,
  100,
  'Control-Account and Subledger Contract',
  'Group/Control/Posting roles, immutable subledger bindings, trusted subledger boundary, Control Adjustments and reconciliation contract. COA-09 remains partial until real AR/AP providers exist.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-IMP-005","title":"Control-Account and Subledger Contract","status":"complete","commit_sha":"87549a28c7b1a600fd28bb569f4d5ce3ba618db5","published":true,"notes":"Group/Control/Posting roles, immutable subledger bindings, trusted subledger boundary, Control Adjustments and reconciliation contract. COA-09 remains partial until real AR/AP providers exist."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-006',
  'ledger-suit',
  80,
  100,
  'Opening-Balance Migration Workflow',
  'Year Start/Midyear opening batches, CSV mapping, exact DR=CR with no plug, preview/approval, idempotent posting, immutability and linked correction.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-IMP-006","title":"Opening-Balance Migration Workflow","status":"complete","commit_sha":"c88cc3c084871f4fa0a2470379c9d6b14baff102","published":true,"notes":"Year Start/Midyear opening batches, CSV mapping, exact DR=CR with no plug, preview/approval, idempotent posting, immutability and linked correction."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-007',
  'ledger-suit',
  90,
  100,
  'Financial Statements, Effective-Dated Mappings, Indirect Cash Flow, and Traceability',
  'Effective-dated mappings, Unclassified handling, mapped P&L/Balance Sheet, indirect Cash Flow, explicit split allocations, statement reconciliation, drill-down and export parity. FS-08 remains partial only for historical descriptive labels after permitted renames.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"ledger-suit.json","source_record":{"task_id":"V2-IMP-007","title":"Financial Statements, Effective-Dated Mappings, Indirect Cash Flow, and Traceability","status":"complete","commit_sha":"310c54f39673abc62c93c32655b4d689d592fe82","implementation_commit_sha":"689b497a8517e4fdf99d32c1e27f4bd4e009aa3c","published":true,"notes":"Effective-dated mappings, Unclassified handling, mapped P&L/Balance Sheet, indirect Cash Flow, explicit split allocations, statement reconciliation, drill-down and export parity. FS-08 remains partial only for historical descriptive labels after permitted renames."},"imported_checkpoint":true,"current_checkpoint":{"task_id":"V2-IMP-007","title":"Financial Statements, Effective-Dated Mappings, Indirect Cash Flow, and Traceability","verdict":"PASS","branch":"codex/ledger-suit/v2-baseline","pr_number":18,"commit_sha":"310c54f39673abc62c93c32655b4d689d592fe82","published":true},"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-008',
  'ledger-suit',
  1000,
  100,
  'Accrual Customer Subledger',
  'Implement customer invoices/accounting obligations, open items, receipt allocation, credits/overpayments/corrections, customer statements, aging and real AR Control reconciliation. Extend counterparties/commitments only where compatible; do not reuse the existing cash-basis settlement behavior that records income on receipt. Legacy commitments require explicit reviewed treatment and must never be automatically converted. Preserve the unstaged opening-balances.vue change if still present. Multi-currency AR/AP is out of scope unless V2-D13 is separately approved.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Invoice/accounting obligation posts exactly once as Dr AR Control / Cr Revenue using the shared posting engine.","Receipt allocation clears AR against Cash and never recognizes Revenue a second time.","Partial and full settlements maintain exact open-item balances.","Credits, unallocated receipts, overpayments, adjustments and reversed allocations follow the approved V2-D05 policy with immutable traceability.","Customer statement roll-forward reconciles opening + charges + adjustments - receipts = closing.","Aging assigns each outstanding amount exactly once under the approved due-date/bucket rules.","As-of customer subledger total equals the configured AR Control account, with zero or explicitly explained variance.","Tenant isolation, permissions, period controls, idempotency and concurrent allocation/posting remain enforced.","Existing legacy commitments are not silently reinterpreted or rewritten."]'::jsonb,
  '["Focused disposable-local SQL fixture for invoice recognition, receipt allocation, partial/full settlement and no duplicate revenue.","Focused allocation/credit/reversal scenarios defined by approved V2-D05.","AR subledger-to-Control reconciliation by as-of date.","Concurrent/idempotent invoice and receipt tests.","Legacy commitment dry-run mapping/variance evidence with no automatic conversion.","Focused EN/LTR and AR/RTL customer-subledger browser coverage.","Pre/post migration journal, entry, debit/credit and Control-balance reconciliation.","Changed-file typecheck/lint and git diff check only; no broad suites unless a focused failure requires them."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"planned","allowed_paths":["apps/ledger-suit/app/","apps/ledger-suit/supabase/migrations/","apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"source_allowed_paths":["apps/ledger-suit/app/**","apps/ledger-suit/supabase/migrations/**","apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-009',
  'ledger-suit',
  1010,
  100,
  'Accrual Supplier Subledger',
  'Implement supplier bills/open items, payment allocation, supplier credits/overpayments/corrections, statements, aging and real AP Control reconciliation. Payment must clear AP against Cash and must not recognize the expense or asset again. Legacy payables require explicit reviewed handling, never automatic conversion. Multi-currency AR/AP is out of scope unless V2-D13 is separately approved.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Supplier bill posts exactly once as Dr approved Expense/Asset / Cr AP Control.","Payment allocation posts Dr AP Control / Cr Cash only and never duplicates Expense/Asset recognition.","Partial and full settlement maintain exact supplier open-item balances.","Credits, unallocated payments, overpayments, adjustments and reversed allocations follow approved V2-D06 policy with immutable traceability.","Supplier statement roll-forward reconciles opening + bills + adjustments - payments = closing.","Aging assigns each outstanding amount exactly once under approved rules.","As-of supplier subledger equals configured AP Control with zero or explicitly explained variance.","Permissions, organization isolation, periods, idempotency and concurrency remain enforced.","Legacy payable history is preserved and not silently converted."]'::jsonb,
  '["Focused disposable-local SQL fixtures for bill recognition, payment allocation, partial/full settlement and no duplicate expense/asset.","Focused supplier credit/overpayment/reversal cases defined by V2-D06.","AP subledger-to-Control reconciliation by date.","Concurrent/idempotent bill and payment scenarios.","Legacy payable dry-run/variance evidence.","Focused EN/LTR and AR/RTL browser coverage.","Pre/post migration journal, entry, debit/credit and Control reconciliation.","Changed-file typecheck/lint and git diff check only."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"planned","allowed_paths":["apps/ledger-suit/app/","apps/ledger-suit/supabase/migrations/","apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"source_allowed_paths":["apps/ledger-suit/app/**","apps/ledger-suit/supabase/migrations/**","apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-010',
  'ledger-suit',
  1020,
  100,
  'Bank Reconciliation',
  'Implement bank-statement batches/lines, validation and duplicate protection, match/unmatch/correction, explicit accounting adjustments, reconciliation completion and immutable history. Matching an existing transaction must only create links/status and must never repost the existing journal.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Valid statement import creates reviewable statement lines without creating accounting journals.","Duplicate files/lines and invalid rows are detected under approved V2-D08 identity/tolerance rules.","Matching existing journals changes reconciliation links/status only; journal count and ledger totals remain unchanged.","Matched, unmatched and unresolved states are visible and reconcile to statement totals.","Authorized unmatched adjustments create exactly one linked balanced journal through the shared posting engine.","Match, unmatch, correction, completion and reopening obey the approved V2-D08 transition policy.","Statement balance reconciles to ledger balance plus/minus explicitly listed outstanding items.","Statement line, match, journal/adjustment and reconciliation-session history remain traceable."]'::jsonb,
  '["Focused statement import/dedup SQL fixtures.","Before/after journal fingerprint proving normal matching does not post again.","Approved one-to-one/one-to-many/many-to-one scenarios as determined by V2-D08.","Adjustment idempotency and period/permission checks.","Reconciliation equation fixture including outstanding items.","Match/unmatch/completion history tests.","Focused EN/LTR and AR/RTL reconciliation workspace browser coverage.","Pre/post migration accounting totals and git diff check."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"planned","allowed_paths":["apps/ledger-suit/app/","apps/ledger-suit/supabase/migrations/","apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"source_allowed_paths":["apps/ledger-suit/app/**","apps/ledger-suit/supabase/migrations/**","apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-011',
  'ledger-suit',
  1030,
  100,
  'Fixed Assets and Depreciation',
  'Implement the fixed-asset register, acquisition links, approved depreciation schedules and postings, cost/accumulated-depreciation/NBV reporting, disposal/gain-loss handling, correction lifecycle and register-to-GL reconciliation. Do not infer assets automatically from historical purchase journals without reviewed mapping.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Each registered asset has stable identity, acquisition source/journal and designated ledger accounts.","Required depreciation inputs are validated under approved V2-D09 policy.","Depreciation schedule mathematically allocates the approved depreciable basis.","Exactly one depreciation journal exists per asset/period under retries/concurrency.","Original cost - accumulated depreciation = NBV for each tested date.","Disposal removes cost/accumulated depreciation and posts the approved gain/loss.","Asset-register cost and accumulated-depreciation totals reconcile to GL accounts.","Acquisition, depreciation and disposal corrections preserve original history through linked reversals/replacements."]'::jsonb,
  '["Focused acquisition-through-disposal deterministic asset fixture.","Schedule math and proration cases from approved V2-D09.","Idempotent/concurrent depreciation posting test.","Register-to-GL reconciliation.","Gain/loss disposal fixture.","Correction/reversal traceability.","Focused bilingual asset-register UI checks.","Pre/post migration financial preservation evidence."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"planned","allowed_paths":["apps/ledger-suit/app/","apps/ledger-suit/supabase/migrations/","apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"source_allowed_paths":["apps/ledger-suit/app/**","apps/ledger-suit/supabase/migrations/**","apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-012',
  'ledger-suit',
  1040,
  100,
  'Accounting Dimensions',
  'Implement controlled cost-center/project accounting dimensions, controlled values and line allocations, historical validity, report filtering/grouping and explicit Unassigned reconciliation. Keep the scope financial only; do not introduce project-management operations.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Authorized users can create/edit/archive controlled dimension values while preserving historical references.","Applicable accounting amounts reference valid tenant-scoped dimensions according to V2-D10.","Multi-allocation, if approved, sums exactly to the journal-line amount.","GL/TB/approved statements can filter or group by dimension.","Assigned dimension groups plus explicit Unassigned always equal the unfiltered ledger total.","Inactive values and historical/retroactive changes follow approved policy without rewriting posted history.","No scheduling, tasks, resources or operational project-management functionality is introduced."]'::jsonb,
  '["Focused dimension-value lifecycle tests.","Allocation sum and over-allocation rejection tests.","Historical/inactive behavior under approved V2-D10.","Grouped + Unassigned = unfiltered TB/GL reconciliation.","Tenant/permission/idempotency checks where applicable.","Focused EN/LTR and AR/RTL dimension/report UI coverage.","Dry-run reporting against legacy generic dimensions JSON without assuming it is valid."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"planned","allowed_paths":["apps/ledger-suit/app/","apps/ledger-suit/supabase/migrations/","apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"source_allowed_paths":["apps/ledger-suit/app/**","apps/ledger-suit/supabase/migrations/**","apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-013',
  'ledger-suit',
  1050,
  100,
  'Approved Tax/VAT Accounting',
  'Implement only the jurisdiction, business circumstances, documents, calculations, mappings, adjustments and reports approved by V2-D11 and supported by dated authoritative regulatory evidence. No legal/compliance completeness claim is permitted from schema fields or calculations alone. This task has a real non-decision blocker: current authoritative regulatory evidence has not yet been supplied/verified.',
  'feature',
  'critical',
  'deep',
  'blocked',
  '["Implementation scope exactly matches approved V2-D11 jurisdiction/business circumstances and current authoritative evidence.","Approved source documents calculate exact expected tax amounts using the approved rounding/tax-point rules.","Applicable tax effects post once through the shared accounting engine.","Tax report reconciles exactly to designated tax-control GL accounts and source documents.","Adjustments/reversals preserve effective-date history and traceability.","Tenant isolation, permissions, periods and idempotency remain enforced.","External e-invoicing/e-receipt/government submission is excluded unless explicitly approved.","Product wording does not claim compliance beyond the verified scope."]'::jsonb,
  '["Obtain and record dated authoritative regulatory sources before implementation readiness.","Accountant/product approval of deterministic tax fixtures.","Focused calculation and rounding tests from approved examples.","Tax report = tax Control GL = source-document reconciliation.","Adjustment/reversal/effective-date tests.","Focused bilingual UI/report coverage.","Pre/post migration reconciliation and no historical recalculation.","Final wording review for scoped compliance claims."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"blocked","allowed_paths":["apps/ledger-suit/app/","apps/ledger-suit/supabase/migrations/","apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/"],"source_allowed_paths":["apps/ledger-suit/app/**","apps/ledger-suit/supabase/migrations/**","apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/**"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-014',
  'ledger-suit',
  1060,
  100,
  'Approved Inventory Accounting',
  'Connect an explicitly approved inventory movement/valuation source to Inventory Control and COGS through the shared ledger. Implement the approved costing, return, backdating and correction policy without expanding into warehouse management, procurement, sales-order management or manufacturing. Any tax/dimension dependency is conditional on the V2-D12-approved scope.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Approved movement source is authoritative and each in-scope movement produces one deterministic linked accounting effect.","Inventory increases, decreases, returns and valuation adjustments follow approved V2-D12 accounting treatment.","Approved costing/valuation method produces deterministic results and handles corrections/backdating according to policy.","Inventory valuation reconciles to Inventory Control GL.","COGS reconciles to designated COGS accounts.","Source movement ↔ valuation ↔ journal traceability is preserved.","Idempotency/concurrency prevents duplicate inventory/COGS posting.","No operational WMS/procurement/order/manufacturing features are introduced."]'::jsonb,
  '["Deterministic purchase/increase/decrease/return/adjustment fixtures from approved V2-D12.","Costing/valuation calculations under approved method.","Inventory valuation and COGS-to-GL reconciliation.","Backdated/correction cases defined by policy.","Idempotency and concurrent movement posting checks.","Source-to-journal traceability.","Focused bilingual accounting UI/report verification.","Pre/post migration and source snapshot variance report."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"planned","allowed_paths":["apps/ledger-suit/app/","apps/ledger-suit/supabase/migrations/","apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"source_allowed_paths":["apps/ledger-suit/app/**","apps/ledger-suit/supabase/migrations/**","apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/i18n/locales/en.json","apps/ledger-suit/i18n/locales/ar.json","apps/ledger-suit/types/database.types.ts","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'V2-IMP-015',
  'ledger-suit',
  1070,
  100,
  'Cross-Module Accounting Reconciliation and Accountant Acceptance',
  'Run the complete implemented accounting story on a clean disposable environment, rehearse migrations/recovery, verify cross-module reconciliation, regression, permissions, organization isolation, localization and responsive behavior, and collect independent accountant acceptance. This is an acceptance/review task, not a place to hide new feature work. Any defect requiring runtime changes should become a separately controlled repair task. Final acceptance must also close residual JRN-02/JRN-03 numbering after V2-D03 and verify the remaining FS-08 historical-label behavior.',
  'review',
  'critical',
  'review',
  'planned',
  '["Every approved requirement has distinct code-implemented, tests-passed, deployed and accountant-accepted states.","Journal debits equal credits across representative data and migration rehearsals.","Trial Balance, General Ledger and financial statements reconcile for the same dates/context.","Real AR/AP subledgers reconcile to their Control accounts.","Bank reconciliation, fixed-asset register, dimensions and any implemented tax/inventory modules reconcile to GL.","CORE-08 pre/post migration reconciliation evidence is complete.","Duplicate/idempotency and close/post concurrency barriers pass in the integrated environment.","Recovery/forward-fix procedures are rehearsed without deleting or rewriting posted history.","EN/AR, RTL, responsive, permission and tenant-isolation acceptance scenarios pass.","V2-D03 is resolved and final JRN-02/JRN-03 professional numbering behavior is implemented/verified before full completion.","FS-08 historical descriptive-label behavior after permitted rename is verified or explicitly accepted with documented limitation.","Named accountant reviews independent expected balances/reports and signs V2 acceptance evidence."]'::jsonb,
  '["Fresh disposable cumulative migration replay.","Representative sanitized accounting dataset where authorized.","Pre/post journal/entry counts, debit/credit sums, TB, Balance Sheet and module-control reconciliations.","Integrated SQL/unit/E2E verification selected from each completed module rather than blindly rerunning every historical test.","Cross-module duplicate, permission, organization-isolation and close/post concurrency matrix.","Migration recovery/forward-repair drill with timings and artifacts.","EN/LTR and AR/RTL accountant workflows.","Independent expected-balance artifacts reviewed by a named accountant.","Record unresolved defects separately; do not modify tests to mask failures."]'::jsonb,
  '{"handoff_source":"ledger-suit.json","original_status":"planned","allowed_paths":["apps/ledger-suit/supabase/tests/","apps/ledger-suit/tests/","apps/ledger-suit/docs/accountant-system/","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"source_allowed_paths":["apps/ledger-suit/supabase/tests/**","apps/ledger-suit/tests/**","apps/ledger-suit/docs/accountant-system/**","apps/ledger-suit/docs/accountant-system/v2-baseline/BASELINE.md"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-BASE-001',
  'shop-suit',
  10,
  100,
  'Evidence-backed Shop Suit implementation baseline',
  'Established canonical tracker, requirement audit, implementation sequence, preservation rules, security findings, and unresolved decisions. Planning/tracking only.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-BASE-001","title":"Evidence-backed Shop Suit implementation baseline","status":"complete","branch":"codex/shop-suit/requirements-v1","pr_number":19,"commit_sha":null,"notes":"Established canonical tracker, requirement audit, implementation sequence, preservation rules, security findings, and unresolved decisions. Planning/tracking only."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-BASE-CHK-001',
  'shop-suit',
  20,
  100,
  'Commit and push accepted Shop Suit baseline',
  'Durable baseline checkpoint published.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-BASE-CHK-001","title":"Commit and push accepted Shop Suit baseline","status":"complete","branch":"codex/shop-suit/requirements-v1","pr_number":19,"commit_sha":"ad6860bf7d1f4499b028b7b60dcf2910f29973a7","notes":"Durable baseline checkpoint published."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-BIZ-001',
  'shop-suit',
  30,
  100,
  'Operational business mode independent of subscription',
  'Product/service/mixed mode persisted independently of subscription; owner mutation, onboarding/settings, mode-aware UI and targeted security tests completed.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-BIZ-001","title":"Operational business mode independent of subscription","status":"complete","branch":"codex/shop-suit/requirements-v1","pr_number":19,"commit_sha":"0a2b097f50e591797f938b4f29b72e1956dd129d","notes":"Product/service/mixed mode persisted independently of subscription; owner mutation, onboarding/settings, mode-aware UI and targeted security tests completed."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-PR-CHAIN-001',
  'shop-suit',
  40,
  100,
  'Repair Shop Suit PR topology',
  'Removed incorrect Ledger parent and established Shop-specific stack root at stg.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-PR-CHAIN-001","title":"Repair Shop Suit PR topology","status":"complete","branch":"codex/shop-suit/requirements-v1","pr_number":19,"commit_sha":null,"notes":"Removed incorrect Ledger parent and established Shop-specific stack root at stg."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-WORKFLOW-001',
  'shop-suit',
  50,
  100,
  'App-specific PR stack repository policy',
  'Initial publication was interrupted by unrelated dirty Ledger work; implementation was preserved and completed by SS-WORKFLOW-001-R1.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-WORKFLOW-001","title":"App-specific PR stack repository policy","status":"complete_via_recovery","branch":"codex/shared/app-specific-pr-stacks","pr_number":20,"commit_sha":"0f49c50c72ebffa996e7faeae11d83b8d311be17","notes":"Initial publication was interrupted by unrelated dirty Ledger work; implementation was preserved and completed by SS-WORKFLOW-001-R1."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-WORKFLOW-001-R1',
  'shop-suit',
  60,
  100,
  'Publish and propagate app-specific PR policy',
  'PR #20 merged. Repository now permits one root PR per codex/<stack> namespace and rejects cross-app child stacks.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-WORKFLOW-001-R1","title":"Publish and propagate app-specific PR policy","status":"complete","branch":"codex/shared/app-specific-pr-stacks","pr_number":20,"commit_sha":"0f49c50c72ebffa996e7faeae11d83b8d311be17","merge_commit_sha":"d26c10efbd85bcc7750145fa8e871f746dc9e269","notes":"PR #20 merged. Repository now permits one root PR per codex/<stack> namespace and rejects cross-app child stacks."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-SAFE-001',
  'shop-suit',
  70,
  100,
  'Same-shop reference and supported-command hardening',
  'PR #21 merged into Shop root. Supported command boundary, private-helper revocation, same-shop constraints, direct-write protection and targeted security/idempotency coverage completed.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-SAFE-001","title":"Same-shop reference and supported-command hardening","status":"complete","branch":"codex/shop-suit/ss-safe-001","pr_number":21,"commit_sha":"fa4bcf28bc223a3902ebf77f0a4f6eda2ffa7117","merge_commit_sha":"b0b00f58e892ac823f5dbe9f4a07f054988a2c2c","notes":"PR #21 merged into Shop root. Supported command boundary, private-helper revocation, same-shop constraints, direct-write protection and targeted security/idempotency coverage completed."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-CUST-001',
  'shop-suit',
  80,
  100,
  'Customer master data and receivable-ready foundation',
  'PR #22 merged. Customer create/edit/archive/detail, server-side search/pagination, same-shop references and historical preservation completed.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-CUST-001","title":"Customer master data and receivable-ready foundation","status":"complete","branch":"codex/shop-suit/ss-cust-001","pr_number":22,"commit_sha":"540804c7bc3b03c1f636610b442cd970e1ee93c4","published_head_sha":"f2ea1f26f3ff5c2fe7ff6b234ec7db1a1c263f80","merge_commit_sha":"a1ce24c6133a35be04e7efee079f0dba6f4a600e","notes":"PR #22 merged. Customer create/edit/archive/detail, server-side search/pagination, same-shop references and historical preservation completed."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-SALE-001',
  'shop-suit',
  90,
  100,
  'Atomic product/service sale issuance',
  'PR #23 merged. Draft/issue flow, product/service/mixed sales, authoritative totals, FIFO stock deduction, race-safe numbering, snapshots, idempotency and real concurrency evidence completed.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-SALE-001","title":"Atomic product/service sale issuance","status":"complete","branch":"codex/shop-suit/ss-sale-001","pr_number":23,"commit_sha":"098b7022ddb7a577c9e6f1de0eeff0622e71cdc0","merge_commit_sha":"4e57b20375d0f6cabb5f4bd08a64b55e939c62bd","notes":"PR #23 merged. Draft/issue flow, product/service/mixed sales, authoritative totals, FIFO stock deduction, race-safe numbering, snapshots, idempotency and real concurrency evidence completed."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-PAY-001',
  'shop-suit',
  100,
  100,
  'Customer receipts, allocation, reversals, refunds, statements and atomic customerless checkout',
  'PR #25 merged into Shop root. Partial/full/multi-invoice receipts, immutable allocations, partial/full reversals/refunds, due/overdue, statements, money concurrency protection and fully-paid customerless atomic checkout completed.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"shop-suit.json","source_record":{"task_id":"SS-PAY-001","title":"Customer receipts, allocation, reversals, refunds, statements and atomic customerless checkout","status":"complete","branch":"codex/shop-suit/ss-pay-001","pr_number":25,"commit_sha":"9709871deeef11b0e963042e0c300565c80e7e39","merge_commit_sha":"3036bf21bf51ac763a5f701a40157f0f1d2144ec","notes":"PR #25 merged into Shop root. Partial/full/multi-invoice receipts, immutable allocations, partial/full reversals/refunds, due/overdue, statements, money concurrency protection and fully-paid customerless atomic checkout completed."},"imported_checkpoint":true,"current_checkpoint":{"task_id":"SS-PAY-001","verdict":"PASS","branch":"codex/shop-suit/ss-pay-001","pr_number":25,"commit_sha":"9709871deeef11b0e963042e0c300565c80e7e39","published":true},"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-PUR-002',
  'shop-suit',
  1000,
  100,
  'Complete suppliers, payables, and purchase returns',
  'Complete supplier lifecycle, purchase detail/search, supplier payments/payables, and traceable purchase return/credit behavior while preserving existing supplier-purchase idempotency, snapshots and FIFO receipt foundations.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Supplier CRUD/archive/search/contact workflow is complete and historical supplier identity is preserved.","Purchase/bill list, filters, detail and drill-through to payments/inventory are server-backed and usable.","Full and partial supplier payments reconcile to authoritative remaining payable.","Multiple payments against one purchase are supported without duplicate money on retry.","Approved supplier credits/returns follow PUR-D01 through PUR-D04.","Purchase returns reduce stock and valuation exactly once and remain linked to the original purchase.","Consumed-stock return cases follow the approved policy rather than silently creating negative or fictitious stock.","Same-shop, authorization, closed-period, idempotency and concurrency guarantees are enforced backend-side.","No advanced requisition/procurement/approval-chain scope is introduced."]'::jsonb,
  '["Focused supplier/payables SQL suite covering partial/full payments, idempotency, cross-shop denial and return/credit invariants.","Real concurrency coverage for duplicate supplier payment / return races where materially relevant.","FIFO/payable reconciliation fixtures.","Shop typecheck and changed-file lint when application code changes.","git diff --check and canonical tracker validation.","Targeted bilingual supplier/purchase/payment/return UI verification if authenticated fixture is available.","Run agent:pr-check after opening the stacked Draft PR."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-STOCK-002',
  'shop-suit',
  1010,
  100,
  'Counts, low-stock, and full correction lifecycle',
  'Complete physical stock counts, variance history, low-stock thresholds/actionable views, correction traceability, archived-stock visibility and FIFO valuation reconciliation.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Controlled physical stock-count workflow records count, variance, actor, date and reason/reference.","Count/correction operations are atomic, concurrency-safe and idempotent.","Low-stock/reorder threshold is shop/product scoped and exposed through an actionable view.","Negative stock remains prohibited.","Archived/discontinued products with remaining stock/history remain visible where required.","Inventory valuation reconciles exactly to remaining FIFO cost layers/movements.","Every correction has a traceable source/reference and does not silently rewrite history.","Multi-warehouse/location inventory remains out of initial scope."]'::jsonb,
  '["Focused stock-count/correction SQL suite.","Real count-versus-sale concurrency test.","Negative-stock and idempotency tests.","Archived-product-with-stock regression.","FIFO valuation reconciliation fixture.","Shop typecheck/lint for changed UI files only.","git diff --check, tracker validation and agent:pr-check.","Targeted mobile/desktop count/low-stock/history manual verification when auth fixture is available."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-SALE-002',
  'shop-suit',
  1020,
  100,
  'Sale documents, corrections, returns, and approved tax policy',
  'Complete printable/shareable sales documents and append-only sale correction/void/return behavior, including exactly-once stock/payment effects. Add custom/manual lines or VAT/tax only after their explicit decisions are approved.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Printable/shareable customer document is stable and suitable for small-business use.","Issued sale history is never silently rewritten.","Every correction/void/refund/return preserves linkage to the original document.","Sales returns restore stock exactly once and preserve FIFO valuation traceability.","Payment/refund state reconciles with sale correction state without duplicate money.","Repeated correction/return requests are idempotent.","Partial-return behavior follows SALE-D04.","Custom/manual lines are exposed only if SALE-D01 is approved.","Tax/VAT behavior is added only if SALE-D02 is approved and no unsupported compliance claim is made.","Historical document snapshots remain stable after later catalog/settings changes."]'::jsonb,
  '["Focused sale correction/return SQL tests including repeated requests.","Partial/full return tests according to approved policy.","Stock/payment reconciliation and cross-shop tests.","Historical snapshot immutability tests.","Shop typecheck and changed-file lint.","git diff --check, tracker validation and agent:pr-check.","Targeted bilingual print/share/correction UI verification when authentication is available."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-SERV-002',
  'shop-suit',
  1030,
  100,
  'Optional service material consumption',
  'If approved for V1, add versioned service-material definitions and atomic FIFO material consumption during service sale issuance while keeping ordinary services inventory-independent and preventing duplicate customer charging.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Material consumption is implemented only after SERV-D01 approves it for V1.","Configured materials consume stock exactly once at issue.","Unconfigured services remain completely inventory-independent.","Consumed material does not create a second customer charge unless explicitly sold as a sale line.","Historical issued material snapshots survive later recipe edits.","Units/rounding follow SERV-D02.","Recipe/version effective-date behavior follows SERV-D03.","Insufficient stock, retry, concurrency and cross-shop behavior remain safe.","FIFO and negative-stock policies are preserved."]'::jsonb,
  '["Focused material-definition and sale-consumption SQL tests.","Retry/concurrency and insufficient-stock tests.","Snapshot-version stability tests.","Cross-shop product/service reference tests.","Shop typecheck/lint for changed application files.","git diff --check, tracker validation and agent:pr-check.","Targeted configured-service and ordinary-service UI verification if auth fixture exists."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-EXP-002',
  'shop-suit',
  1040,
  100,
  'Complete expense history and approved operational income',
  'Finish server-paged/searchable expense history, correction/void UX and delegated permissions. Add other operational income only if its launch scope and semantics are explicitly approved.',
  'feature',
  'high',
  'standard',
  'planned',
  '["Expense history is server-paged/searchable/filterable across full history.","Expense create/edit/correction/void behavior preserves original history.","Expense retries remain idempotent.","Closed-period and backend permission restrictions remain authoritative.","Delegated permissions are usable without requiring owner status by default.","Any approved operational-income model is separate and semantically cannot duplicate sales revenue.","Operational cash labels do not imply a general ledger.","No unapproved operational-income workflow is exposed."]'::jsonb,
  '["Focused expense pagination/filter/permission/idempotency SQL tests.","Closed-period and void-history regression tests.","If income is approved, focused income reconciliation/idempotency tests.","Shop typecheck/lint for changed UI files.","git diff --check, tracker validation and agent:pr-check.","Targeted bilingual expense/correction UI verification when auth is available."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-TEAM-001',
  'shop-suit',
  1050,
  100,
  'Invitations, roles, seats, and suspension',
  'Implement secure staff invitation, role/permission administration, suspension/removal, owner continuity and sensitive-action audit using the now-stable operational command permissions.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Team-management UI exists and is not merely membership-table exposure.","Invitation tokens are controlled, single-use and expire according to TEAM-D02.","Invitations/acceptance cannot exceed approved seat policy.","Roles cannot escalate beyond the acting administrator''s authority.","Granular view/manage and sensitive-action permissions are enforced backend-side.","Active/suspended/removed states preserve history.","Suspension/removal blocks protected access according to actual session/auth guarantees.","Last-owner/owner-continuity safeguards prevent loss of administrative authority.","Sensitive staff actions are auditable.","Cross-shop role/membership references are rejected."]'::jsonb,
  '["Focused invitation replay/expiry/acceptance SQL tests.","Seat-race test if a seat quota is approved.","Privilege-escalation, last-owner, suspension and cross-shop tests.","Open-session suspension verification where supported by auth model.","Shop typecheck/lint.","git diff --check, tracker validation and agent:pr-check.","Targeted owner/staff invitation and suspension browser verification when auth fixtures are available."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-RPT-001',
  'shop-suit',
  1060,
  100,
  'Reconciled dashboard and operational reports',
  'Replace placeholder/readiness reporting with full-history, tenant-safe operational dashboard/reporting that reconciles to sales, receipts, suppliers/payables, expenses and FIFO inventory source records.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Dashboard surfaces actionable sales, collections, receivables, payables, expenses, low stock and recent activity according to enabled capabilities.","Sales, customer collection/outstanding, supplier purchase/payment/payable and stock reports use full-history server-side calculations.","Stock valuation reconciles to Shop Suit FIFO layers/movements.","Profitability/margin appears only where cost calculations are well-defined and reconciled.","Operating-result summaries do not present Shop Suit as a formal accounting ledger.","Every report supports source drill-through where required.","Approved exports use exactly the same filters/calculations as displayed results.","Tenant isolation and permission boundaries are enforced on reports/exports."]'::jsonb,
  '["Known-fixture reconciliation tests for each report family.","Pagination/full-history boundary tests.","Date/timezone filter tests.","Tenant/permission tests.","Export filter/formula/escaping tests.","Shop typecheck/lint.","git diff --check, tracker validation and agent:pr-check.","Targeted bilingual dashboard/report/export drill-through browser verification."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-SUB-001',
  'shop-suit',
  1070,
  100,
  'Approved resource entitlements and lifecycle',
  'Replace provisional Basic/Pro/business-type gating assumptions with an approved resource-based entitlement model, usage display, concurrency-safe quotas, expiry/downgrade semantics and independent Shop subscription management.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Only explicitly approved plan catalog values are presented as commercial truth.","Business type remains independent from subscription tier.","Backend quota checks are authoritative, atomic and concurrency-safe.","Retries/idempotent operations do not consume quota twice.","Usage is visible before rejection.","Expiry/downgrade never deletes historical data.","History-read/write restrictions follow SUB-D06.","Over-limit downgrade behavior follows SUB-D07 without silent archival/deletion.","Upgrade/downgrade actions follow approved policy and cannot be self-granted by clients.","Subscription/settings UI shows approved plan, trial/renewal and usage state.","Payment-provider implementation remains outside this task."]'::jsonb,
  '["Quota concurrency/race tests.","Retry/no-double-usage tests.","Expiry boundary tests.","Downgrade/reactivation/over-limit tests.","Self-upgrade/authorization denial tests.","Usage reconciliation fixtures.","Shop typecheck/lint.","git diff --check, tracker validation and agent:pr-check.","Manual plan/usage/expiry state verification for approved plans when auth fixture is available."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-SET-001',
  'shop-suit',
  1080,
  100,
  'Business, document, and operational settings',
  'Implement coherent tenant-scoped business/profile, invoice/receipt presentation, currency and approved operational settings while snapshotting values into future finalized documents and never rewriting historical records.',
  'feature',
  'normal',
  'standard',
  'planned',
  '["Authorized business/profile settings validate and persist.","Invoice/receipt display settings follow SET-D02.","Supported currency behavior follows SET-D01 and does not imply unsafe currency conversion.","Any tax default is added only after SET-D03/SALE-D02 approval.","New finalized documents snapshot relevant settings.","Existing finalized documents never change after settings edits.","Settings are not treated as authorization boundaries.","Future branch/location support is not accidentally implied.","Unauthorized staff/outsiders are denied backend-side."]'::jsonb,
  '["Settings validation/authorization SQL tests.","Historical snapshot immutability tests.","Concurrent update behavior test where relevant.","Shop typecheck/lint.","git diff --check, tracker validation and agent:pr-check.","Bilingual old-document/new-document manual verification when auth fixture is available."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","package.json"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","package.json"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-UX-001',
  'shop-suit',
  1090,
  100,
  'Cross-workflow accessibility, pagination, and responsive hardening',
  'Perform the consolidated UI/UX hardening pass across every launch workflow, including the authenticated browser checks that earlier targeted tasks intentionally left unverified.',
  'review',
  'normal',
  'review',
  'planned',
  '["Every launch workflow has correct English/Arabic and LTR/RTL behavior.","Responsive/mobile-first behavior is verified across representative widths.","Loading, empty, error, success and permission-denied states exist where applicable.","Money/stock-impacting actions clearly communicate their effects before confirmation.","Terminology consistently distinguishes sale, payment, purchase, receipt, adjustment, expense, refund and return.","Growing datasets use server-side pagination/filtering.","Writes refresh the correct shop-scoped state without manual browser reload or cross-shop leakage.","Status is never conveyed only through color.","Keyboard/focus/accessibility behavior follows the Building Suit design system.","UI never advertises schema-only/dormant workflows as working capabilities."]'::jsonb,
  '["Authenticated browser matrix for all launch workflows.","English/Arabic and RTL/LTR matrix.","Representative mobile/desktop viewport matrix.","Keyboard/focus/accessibility checks.","Loading/empty/error/permission-state checks.","Pagination and shop/account cache-invalidation regressions.","Targeted component/browser tests rather than broad implementation rewrites.","Shop typecheck/lint and agent:pr-check for any resulting hardening changes."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","packages/ui/","packages/ux/","packages/i18n/","packages/nuxt-layer/","packages/testing/"],"source_allowed_paths":["apps/shop-suit/**","packages/ui/** (only for a verified shared UI defect)","packages/ux/** (only for a verified shared interaction defect)","packages/i18n/** (only for a verified shared localization defect)","packages/nuxt-layer/** (only for a verified shared shell defect)","packages/testing/**"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'SS-VAL-001',
  'shop-suit',
  1100,
  100,
  'Launch qualification',
  'Perform final evidence-backed Shop Suit qualification across database invariants, security, authenticated browser workflows, report reconciliation, subscription limits, recovery/readiness and staging evidence without conflating implementation, verification, deployment and commercial approval.',
  'release',
  'critical',
  'review',
  'planned',
  '["Every approved Shop Suit V1 requirement has current implementation status and evidence in the canonical tracker.","Full affected Shop database regression passes in a disposable environment.","Product-only, service-only and mixed workflows pass.","Purchase → stock increase → sale → stock decrease → correction/return sequences reconcile where implemented.","Partial customer and supplier payment scenarios pass.","Stock insufficiency and concurrency scenarios pass.","Archived/discontinued product history remains queryable.","Owner/staff/suspended/outsider/cross-shop security matrix passes.","Implemented quota/expiry/downgrade behavior passes.","Authenticated Arabic/English, RTL/LTR, responsive and error/loading states are manually or automatically verified.","Operational reports reconcile to source records.","Code implemented, automated tests passed, manually verified, deployed and commercially approved are reported as separate states.","No future Ledger/ERP functionality is claimed as implemented.","Any staging deployment/remote migration/merge step is performed only after separate explicit authorization."]'::jsonb,
  '["Full Shop DB regression suite.","Full affected Shop typecheck/lint/build.","Authenticated end-to-end browser matrix.","Security and tenant-isolation matrix.","Report reconciliation fixtures.","Quota/subscription lifecycle tests.","Migration-chain and restore/recovery checks appropriate to the environment.","Staging health/cutover verification only when explicitly authorized.","Final canonical tracker reconciliation against the authoritative requirements pack."]'::jsonb,
  '{"handoff_source":"shop-suit.json","original_status":"planned","allowed_paths":["apps/shop-suit/","tooling/database/","packages/testing/","docs"],"source_allowed_paths":["apps/shop-suit/**","tooling/database/**","packages/testing/**","docs/**"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-BASE-001',
  'inventory-suit',
  10,
  100,
  'Inventory Suit repository and requirements baseline',
  'Discovery-only baseline. Includes the accepted requirement/decision-semantics correction and canonical requirement-ID correction. It established repository architecture, Shop/Ledger boundaries, first-class registration requirements, task ordering, decisions, risks and requirement classifications. It created no implementation branch, app, migration or PR.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"inventory-suit.json","source_record":{"task_id":"IS-BASE-001","title":"Inventory Suit repository and requirements baseline","verdict":"PASS","published":false,"notes":"Discovery-only baseline. Includes the accepted requirement/decision-semantics correction and canonical requirement-ID correction. It established repository architecture, Shop/Ledger boundaries, first-class registration requirements, task ordering, decisions, risks and requirement classifications. It created no implementation branch, app, migration or PR."},"imported_checkpoint":false,"current_checkpoint":null,"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-BOOT-001',
  'inventory-suit',
  20,
  100,
  'Inventory Suit first-class application bootstrap',
  'Live GitHub state confirms PR #24 was merged into stg. Inventory Suit now exists as a first-class app with independent local Supabase configuration, monorepo registration, bilingual shared shell and canonical readiness tracking. The remote bootstrap branch has been deleted after merge. No Inventory business domain was implemented by this task.',
  'maintenance',
  'normal',
  'no_ai',
  'complete',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"handoff_source":"inventory-suit.json","source_record":{"task_id":"IS-BOOT-001","title":"Inventory Suit first-class application bootstrap","verdict":"PASS","branch":"codex/inventory-suit/requirements-v1","pr_number":24,"commit_sha":"be7e6186b92cbf25f63f840cb6e031a9447926d4","merge_commit_sha":"e2a76bc1cfc3c38e98a55abdfa09270da0771549","published":true,"notes":"Live GitHub state confirms PR #24 was merged into stg. Inventory Suit now exists as a first-class app with independent local Supabase configuration, monorepo registration, bilingual shared shell and canonical readiness tracking. The remote bootstrap branch has been deleted after merge. No Inventory business domain was implemented by this task."},"imported_checkpoint":true,"current_checkpoint":{"task_id":"IS-BOOT-001","title":"Inventory Suit first-class application bootstrap","verdict":"PASS","branch":"codex/inventory-suit/requirements-v1","pr_number":24,"commit_sha":"be7e6186b92cbf25f63f840cb6e031a9447926d4","published":true},"allowed_paths":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-TEN-001',
  'inventory-suit',
  1000,
  100,
  'Tenant/auth/membership/RLS foundation',
  'Implement Inventory organizations/workspaces, authoritative memberships/capabilities, tenant isolation, membership state, warehouse-scope authority, onboarding and cache clearing using Inventory''s isolated Auth/DB boundary.',
  'database',
  'critical',
  'deep',
  'planned',
  '["All tenant-owned records are server/database tenant-scoped.","Cross-tenant and guessed-reference access fails.","Disabled/suspended users cannot exercise authority.","Client-selected role, tenant or warehouse context never grants authority.","Warehouse scope follows IS-D01.","Tenant/account switching clears sensitive cached state."]'::jsonb,
  '["Focused RLS/SQL authorized, unauthorized, cross-tenant and suspended-user tests.","RPC/grant/search_path review.","Focused onboarding/session-switch browser and unit tests.","Typecheck, lint and diff validation."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-ITEM-001',
  'inventory-suit',
  1010,
  100,
  'Item/UOM/coding foundation',
  'Implement the Inventory item master, exact UOM model/conversions, internal SKU/barcodes and optional ETA/GS1/EGS metadata while preserving structural-history rules.',
  'database',
  'high',
  'deep',
  'planned',
  '["Stable bilingual item identity and archive lifecycle are implemented without destructive history deletion.","Base/alternate UOMs use deterministic exact-decimal normalization while preserving entered values.","Invalid dimensions and ambiguous SKU/barcode identities are rejected.","ETA/GS1/EGS/GPC/GTIN metadata remains optional and independent from internal SKU.","Tracking mode, valuation method and removal strategy are explicit and distinct.","Post-history base-UOM/tracking changes follow IS-D03."]'::jsonb,
  '["DB constraints/RLS and UOM conversion tests.","Exact-decimal and barcode lookup unit tests.","Focused item CRUD/archive UI tests in English/Arabic and RTL/LTR.","Typecheck, lint and diff validation."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-WH-001',
  'inventory-suit',
  1020,
  100,
  'Warehouse/location model',
  'Implement stable warehouses and hierarchical locations including receiving, picking/packing, returns, quarantine, damaged/scrap, transit and virtual/system locations.',
  'database',
  'high',
  'deep',
  'planned',
  '["Multiple tenant warehouses have stable identity, metadata and archive lifecycle.","Location hierarchy is tenant/warehouse valid and history safe.","Required operational/system location kinds are representable.","Warehouse authorization hooks consume the tenant authorization foundation.","Location barcode, removal-strategy configuration and cycle-count frequency are supported."]'::jsonb,
  '["SQL/RLS and hierarchy-cycle tests.","Cross-tenant and cross-warehouse reference-denial tests.","Archive/delete/reparent safety tests.","Focused warehouse/location browser tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-STOCK-001',
  'inventory-suit',
  1030,
  100,
  'Immutable stock movement/balance engine',
  'Implement the authoritative append-only stock ledger, documents/lines, movement legs, deterministic balance projections, stable references, idempotency, atomicity, effective timestamps and no-negative V1 enforcement.',
  'database',
  'critical',
  'deep',
  'planned',
  '["Finalized history is immutable and corrections use explicit reversal relationships.","Movements contain source/destination, normalized quantity, timestamps, actor/source/reason and deterministic order.","Current balances are rebuildable/reconcilable and never rely on mutable current_quantity as authority.","Critical commands are authorized, same-tenant validated, idempotent and failure-atomic.","Negative available stock is blocked and commit-time availability is revalidated.","Stable internal IDs/readable references exist; sequential policy follows IS-D07.","Common balance lookup does not scan the complete ledger."]'::jsonb,
  '["Movement/reversal/idempotency/failure-atomicity SQL tests.","Concurrent final-unit consumption tests.","Projection rebuild-versus-ledger reconciliation tests.","Cross-tenant/reference security tests and query/index sanity."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-TRACK-001',
  'inventory-suit',
  1040,
  100,
  'Lot/serial/expiry traceability',
  'Implement lot, serial and expiry tracking dimensions, stock usability states and end-to-end traceability over the stock ledger.',
  'database',
  'high',
  'deep',
  'planned',
  '["All required tracking modes are enforced per item.","Serial identity cannot simultaneously exist in two owned locations.","Lot/serial identities and expiry/status rules are tenant safe.","Expired/quarantine/blocked inventory is excluded from pickable as required.","Finalized tracking history is immutable and recall traceable.","Post-history tracking-mode changes follow IS-D03."]'::jsonb,
  '["Serial-state and lot-quantity DB tests.","Expiry/status pickability tests.","Movement trace reconstruction tests.","Focused lot/serial/expiry browser tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-RECV-001',
  'inventory-suit',
  1050,
  100,
  'Warehouse receipts',
  'Implement manual receipt documents and partial receiving independent of Purchase, including tracking/UOM/cost inputs and atomic stock effects.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Receipts support external references and partial finalization.","Required lot/serial/expiry and entered UOM data are validated and normalized.","Finalization creates immutable stock effects atomically and records valuation inputs.","Retries do not duplicate stock and failure leaves no partial effects.","Corrections use reversal/corrective flows."]'::jsonb,
  '["Receipt SQL tests for success, partial, retry, failure and cross-tenant denial.","Tracking/UOM validation tests.","Focused receipt UI tests including persistence and permission denial.","Typecheck/lint and diff validation."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-ISSUE-001',
  'inventory-suit',
  1060,
  100,
  'Warehouse issues',
  'Implement manual stock issues independent of Sales with authoritative availability checks, operational removal strategies, tracking dimensions, idempotency and correction.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Issue supports external references, partial issue and required tracking/location dimensions.","Finalization atomically validates pickable/available quantity under concurrency.","Manual/FIFO-picking/FEFO/location-priority behavior follows locked capabilities and IS-D04 defaults.","Retries cannot duplicate consumption and failures leave no partial effects.","Corrections use reversal/corrective history."]'::jsonb,
  '["Last-unit concurrency and no-negative tests.","Lot/serial issue and idempotency tests.","Removal-strategy deterministic-order tests.","Permission/cross-tenant/suspended-user and focused browser tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-TRF-001',
  'inventory-suit',
  1070,
  100,
  'Direct/transit transfers',
  'Implement intra-warehouse and inter-warehouse transfers, including direct and shipped/in-transit/received flows with partial receipt and explicit shortage/damage disposition.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Location and warehouse transfers are supported.","Transit stock remains visible and traceable.","Partial receipt and retry are idempotent.","Lots/serials and value identity remain attached through movement.","Internal transfer creates no revenue/expense behavior.","Shortage/damage never silently disappears."]'::jsonb,
  '["Direct and transit transfer SQL tests.","Partial-receipt/retry/tracked-dimension tests.","Cross-warehouse/tenant validation tests.","Focused transfer lifecycle browser tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-RES-001',
  'inventory-suit',
  1080,
  100,
  'Reservations and authoritative available stock',
  'Implement first-class reservation state and authoritative available-stock calculation without changing physical on-hand.',
  'database',
  'critical',
  'deep',
  'planned',
  '["Reservation creation atomically checks availability and cannot over-reserve.","Active reservations reduce available but never physical on-hand.","Release, consume, cancel and expiry are auditable.","Lot/serial-specific reservations work where required.","Retries cannot duplicate reservation or consumption effects.","Available equals pickable minus active reservations after exclusions."]'::jsonb,
  '["Concurrent final-unit reservation tests.","Reservation lifecycle/idempotency tests.","Lot/serial allocation tests.","On-hand/reserved/available reconciliation and authorization tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-COUNT-001',
  'inventory-suit',
  1090,
  100,
  'Physical/cycle counting',
  'Implement full and cycle-count sessions with assignments, blind counts, snapshot/cutoff basis, recounts, tracking dimensions, review/approval and variance application.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Count scope supports warehouse/location/item combinations and assignments.","Blind/expected visibility is policy/permission controlled.","Snapshot/cutoff remains auditable under concurrent stock movement.","Lot/serial/expiry and recounts are supported.","Approved variance posts explicit stock adjustment movements.","Finalized count sessions are not destructively erased."]'::jsonb,
  '["Snapshot/cutoff and movement-during-count DB tests.","Lifecycle/recount/permission tests.","Variance application tests.","Barcode-assisted and focused count browser tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-ADJ-001',
  'inventory-suit',
  1100,
  100,
  'Adjustments/quarantine/write-off',
  'Implement controlled stock gains/losses, quarantine/status changes, write-off/scrap and count variances using immutable movements, explicit reasons and authorized approvals.',
  'feature',
  'critical',
  'deep',
  'planned',
  '["Adjustment documents require reason and authorization.","Gain/loss, damaged, write-off, scrap and quarantine release are explicit and audited.","Finalization is idempotent and failure-atomic.","Corrections use reversal/corrective history.","Valuation impact remains traceable."]'::jsonb,
  '["SQL tests for each adjustment/disposition.","Approval and denial tests.","Retry/rollback/cross-tenant tests.","Count-variance integration and focused browser tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-COST-001',
  'inventory-suit',
  1110,
  100,
  'FIFO/moving-average/specific-ID valuation',
  'Implement authoritative Inventory valuation/cost-layer history, historical/as-of valuation and NRV/write-down operational facts without posting Ledger journals.',
  'database',
  'critical',
  'deep',
  'planned',
  '["FIFO, moving average and specific identification produce deterministic correct values.","Receipt, issue, transfer and adjustment value effects are traceable and tenant isolated.","Historical and as-of valuation is reproducible.","Cost corrections are explicit and auditable.","COST-11 follows IS-D10 and COST-14 follows IS-D02.","NRV facts capture all required fields and never create Ledger account mappings or journals."]'::jsonb,
  '["Golden-case tests for all three valuation methods.","Partial transfer and reversal valuation tests.","Exact-decimal/rounding tests after IS-D02.","Historical/as-of reconciliation and failure-atomicity tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-LOCK-001',
  'inventory-suit',
  1120,
  100,
  'Backdating, locks and valuation recomputation',
  'Implement operational Inventory lock periods and authorized backdating with deterministic, atomic valuation recomputation.',
  'database',
  'critical',
  'deep',
  'planned',
  '["Backdating requires explicit authority.","Locked history rejects unauthorized changes.","Authorized backdating recomputes affected valuation deterministically.","Recomputation never silently changes source quantities/documents.","Recomputed value changes remain audited and failure-atomic.","Inventory locks remain separate from Ledger periods."]'::jsonb,
  '["Lock-boundary and override-denial SQL tests.","Backdated valuation golden cases.","Failure-injection rollback tests.","Audit/reconciliation tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-REP-001',
  'inventory-suit',
  1130,
  100,
  'Replenishment policies/suggestions',
  'Implement min/max/reorder/lead-time/safety-stock policies and explainable replenishment suggestions without creating purchase orders.',
  'feature',
  'normal',
  'standard',
  'planned',
  '["Minimum/reorder point, target/maximum, quantity/multiple, lead time and safety stock are supported.","Suggestions use authoritative available/projected stock.","Recommended quantities are explainable.","No Shop/Purchase commercial record is created automatically.","Tenant/warehouse authorization is respected."]'::jsonb,
  '["Suggestion calculation and edge-case tests.","Authorization and server-query tests.","Focused replenishment browser tests.","Typecheck/lint and diff validation."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-IMP-001',
  'inventory-suit',
  1140,
  100,
  'Imports and opening inventory',
  'Implement structured item/opening/count import/export with safe validation, idempotency and opening stock posted through normal movement/valuation history.',
  'feature',
  'high',
  'deep',
  'planned',
  '["Imports provide complete and row-level validation.","Duplicate SKU/barcode/serial creation is prevented or surfaced.","Opening inventory posts explicit movement/cost/tracking history.","Repeated import/finalization is idempotent.","Imports/exports respect authorization and Arabic/English round-trip.","OPEN-07 follows IS-D09."]'::jsonb,
  '["Fixture-based import validation tests.","Opening inventory movement/valuation/idempotency tests.","Duplicate and permission/cross-tenant tests.","Focused import/export browser tests."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-RPT-001',
  'inventory-suit',
  1150,
  100,
  'Inventory reporting/dashboard',
  'Implement authoritative inventory reports and an operational dashboard over server-side, permission-scoped queries.',
  'feature',
  'normal',
  'standard',
  'planned',
  '["RPT-01..RPT-16 use authoritative stock/valuation/reservation/count/replenishment data.","Reports enforce tenant/warehouse authorization.","Pagination/filtering/sorting are server-side for large data sets.","As-of valuation never uses client approximations.","Dashboard metrics are operationally clear and authoritative.","Common queries avoid N+1 and full-ledger scans."]'::jsonb,
  '["Golden report datasets across all report categories.","Authorization/pagination/filter/sort tests.","Dashboard/report browser tests in English/Arabic and light/dark.","Query/performance sanity checks."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-INT-001',
  'inventory-suit',
  1160,
  100,
  'Integration contracts/transactional outbox',
  'Implement Inventory-side optional versioned integration contracts, stable external references, idempotent inbound commands and reliable transactional outbox without activating live Shop cutover or Ledger journal mapping.',
  'database',
  'high',
  'deep',
  'planned',
  '["Core Inventory remains fully usable with integrations disabled.","Inbound commands use stable external identifiers and are idempotent.","Outbound events persist transactionally and delivery state is retry-safe.","Integration failure cannot corrupt stock.","Contracts/events are versioned.","No shared databases or email-only identity linking is introduced.","One-authority Shop and Ledger-journal ownership invariants are preserved without live activation."]'::jsonb,
  '["Inbound dedupe and outbox atomicity DB tests.","Delivery retry/failure-injection tests.","Contract-version tests.","Cross-Suit DB/import boundary checks."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/contracts/","packages/testing/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/contracts/**","packages/testing/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-SAFE-001',
  'inventory-suit',
  1170,
  100,
  'Cross-cutting security/reconciliation hardening',
  'Audit and harden all Inventory domains against tenant/reference/authorization/idempotency/history/reconciliation/performance failures.',
  'review',
  'critical',
  'review',
  'planned',
  '["Every tenant-owned table/RPC has appropriate RLS, grants and safe search paths.","No browser path bypasses authoritative command invariants.","Security coverage includes authorized, unauthorized, cross-tenant, suspended and warehouse-scoped cases.","Finalized history and referenced masters cannot be destructively corrupted.","Stock/serial/availability/valuation projections reconcile to authoritative history.","Critical commands remain idempotent/failure-atomic.","No hosted production data can be reset by tests."]'::jsonb,
  '["Cross-domain SQL security matrix.","VAL-01..VAL-08 reconciliation validators.","Static secret/boundary checks.","Milestone changed-scope unit/DB/E2E regression suite."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","tooling/checks/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","tooling/checks/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":[]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;
INSERT INTO control.tasks
(task_id, suit_slug, sequence, priority, title, description, task_type, risk_level, model_profile, status, acceptance_criteria, verification_plan, metadata)
VALUES (
  'IS-VER-001',
  'inventory-suit',
  1180,
  100,
  'Bilingual/browser/invariant acceptance milestone',
  'Perform final V1 acceptance across all requirement evidence, localization/accessibility/UI states, security, concurrency, reconciliation and cross-Suit boundaries.',
  'review',
  'high',
  'review',
  'planned',
  '["All 331 stable requirement IDs have implementation/test evidence or an explicitly approved deferred/blocking disposition.","English/Arabic, LTR/RTL, light/dark, responsive, keyboard/focus and loading/empty/error/permission/dirty-form behavior are verified.","Critical concurrency, idempotency, atomicity, reversal and reconciliation scenarios pass.","No unintended Ledger/Shop/shared dependency or regression exists.","Egyptian terminology has final IS-D12 approval.","No Egyptian statutory accounting acceptance claim is made without accountant UAT.","All V1 scope exclusions remain intact."]'::jsonb,
  '["Milestone build/typecheck/lint/unit/DB/browser suites.","Canonical tracker audit of all 331 IDs and decisions.","Cross-tenant/warehouse/security/concurrency acceptance suite.","Accessibility/localization/theme/responsive browser matrix.","Final reconciliation and cross-app boundary checks."]'::jsonb,
  '{"handoff_source":"inventory-suit.json","original_status":"planned","allowed_paths":["apps/inventory-suit/","packages/testing/","tooling/checks/","pnpm-lock.yaml"],"source_allowed_paths":["apps/inventory-suit/**","packages/testing/**","tooling/checks/**","pnpm-lock.yaml"],"noncanonical_requirement_refs":["all remaining authoritative unnumbered acceptance/localization/scope groups"]}'::jsonb
)
ON CONFLICT (task_id) DO UPDATE SET
  suit_slug = EXCLUDED.suit_slug,
  sequence = EXCLUDED.sequence,
  priority = EXCLUDED.priority,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  task_type = EXCLUDED.task_type,
  risk_level = EXCLUDED.risk_level,
  model_profile = EXCLUDED.model_profile,
  status = CASE
    WHEN control.tasks.status IN ('in_progress','verification','passed','failed','complete','cancelled')
      THEN control.tasks.status
    ELSE EXCLUDED.status
  END,
  acceptance_criteria = EXCLUDED.acceptance_criteria,
  verification_plan = EXCLUDED.verification_plan,
  metadata = control.tasks.metadata || EXCLUDED.metadata;

-- Rebuild normalized task links for this imported graph.
DELETE FROM control.task_requirements WHERE task_id IN (
  'LS-V2-BASELINE-001',
  'V2-IMP-001',
  'V2-IMP-002',
  'V2-VER-002A',
  'V2-IMP-003',
  'V2-IMP-004',
  'V2-IMP-005',
  'V2-IMP-006',
  'V2-IMP-007',
  'V2-IMP-008',
  'V2-IMP-009',
  'V2-IMP-010',
  'V2-IMP-011',
  'V2-IMP-012',
  'V2-IMP-013',
  'V2-IMP-014',
  'V2-IMP-015',
  'SS-BASE-001',
  'SS-BASE-CHK-001',
  'SS-BIZ-001',
  'SS-PR-CHAIN-001',
  'SS-WORKFLOW-001',
  'SS-WORKFLOW-001-R1',
  'SS-SAFE-001',
  'SS-CUST-001',
  'SS-SALE-001',
  'SS-PAY-001',
  'SS-PUR-002',
  'SS-STOCK-002',
  'SS-SALE-002',
  'SS-SERV-002',
  'SS-EXP-002',
  'SS-TEAM-001',
  'SS-RPT-001',
  'SS-SUB-001',
  'SS-SET-001',
  'SS-UX-001',
  'SS-VAL-001',
  'IS-BASE-001',
  'IS-BOOT-001',
  'IS-TEN-001',
  'IS-ITEM-001',
  'IS-WH-001',
  'IS-STOCK-001',
  'IS-TRACK-001',
  'IS-RECV-001',
  'IS-ISSUE-001',
  'IS-TRF-001',
  'IS-RES-001',
  'IS-COUNT-001',
  'IS-ADJ-001',
  'IS-COST-001',
  'IS-LOCK-001',
  'IS-REP-001',
  'IS-IMP-001',
  'IS-RPT-001',
  'IS-INT-001',
  'IS-SAFE-001',
  'IS-VER-001'
);
DELETE FROM control.task_dependencies WHERE task_id IN (
  'LS-V2-BASELINE-001',
  'V2-IMP-001',
  'V2-IMP-002',
  'V2-VER-002A',
  'V2-IMP-003',
  'V2-IMP-004',
  'V2-IMP-005',
  'V2-IMP-006',
  'V2-IMP-007',
  'V2-IMP-008',
  'V2-IMP-009',
  'V2-IMP-010',
  'V2-IMP-011',
  'V2-IMP-012',
  'V2-IMP-013',
  'V2-IMP-014',
  'V2-IMP-015',
  'SS-BASE-001',
  'SS-BASE-CHK-001',
  'SS-BIZ-001',
  'SS-PR-CHAIN-001',
  'SS-WORKFLOW-001',
  'SS-WORKFLOW-001-R1',
  'SS-SAFE-001',
  'SS-CUST-001',
  'SS-SALE-001',
  'SS-PAY-001',
  'SS-PUR-002',
  'SS-STOCK-002',
  'SS-SALE-002',
  'SS-SERV-002',
  'SS-EXP-002',
  'SS-TEAM-001',
  'SS-RPT-001',
  'SS-SUB-001',
  'SS-SET-001',
  'SS-UX-001',
  'SS-VAL-001',
  'IS-BASE-001',
  'IS-BOOT-001',
  'IS-TEN-001',
  'IS-ITEM-001',
  'IS-WH-001',
  'IS-STOCK-001',
  'IS-TRACK-001',
  'IS-RECV-001',
  'IS-ISSUE-001',
  'IS-TRF-001',
  'IS-RES-001',
  'IS-COUNT-001',
  'IS-ADJ-001',
  'IS-COST-001',
  'IS-LOCK-001',
  'IS-REP-001',
  'IS-IMP-001',
  'IS-RPT-001',
  'IS-INT-001',
  'IS-SAFE-001',
  'IS-VER-001'
);
DELETE FROM control.task_decisions WHERE task_id IN (
  'LS-V2-BASELINE-001',
  'V2-IMP-001',
  'V2-IMP-002',
  'V2-VER-002A',
  'V2-IMP-003',
  'V2-IMP-004',
  'V2-IMP-005',
  'V2-IMP-006',
  'V2-IMP-007',
  'V2-IMP-008',
  'V2-IMP-009',
  'V2-IMP-010',
  'V2-IMP-011',
  'V2-IMP-012',
  'V2-IMP-013',
  'V2-IMP-014',
  'V2-IMP-015',
  'SS-BASE-001',
  'SS-BASE-CHK-001',
  'SS-BIZ-001',
  'SS-PR-CHAIN-001',
  'SS-WORKFLOW-001',
  'SS-WORKFLOW-001-R1',
  'SS-SAFE-001',
  'SS-CUST-001',
  'SS-SALE-001',
  'SS-PAY-001',
  'SS-PUR-002',
  'SS-STOCK-002',
  'SS-SALE-002',
  'SS-SERV-002',
  'SS-EXP-002',
  'SS-TEAM-001',
  'SS-RPT-001',
  'SS-SUB-001',
  'SS-SET-001',
  'SS-UX-001',
  'SS-VAL-001',
  'IS-BASE-001',
  'IS-BOOT-001',
  'IS-TEN-001',
  'IS-ITEM-001',
  'IS-WH-001',
  'IS-STOCK-001',
  'IS-TRACK-001',
  'IS-RECV-001',
  'IS-ISSUE-001',
  'IS-TRF-001',
  'IS-RES-001',
  'IS-COUNT-001',
  'IS-ADJ-001',
  'IS-COST-001',
  'IS-LOCK-001',
  'IS-REP-001',
  'IS-IMP-001',
  'IS-RPT-001',
  'IS-INT-001',
  'IS-SAFE-001',
  'IS-VER-001'
);

INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'AR-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-008', 'ledger-suit', 'COA-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-008', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-008', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-008', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-008', 'ledger-suit', 'V2-D05', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'AP-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-009', 'ledger-suit', 'COA-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-009', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-009', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-009', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-009', 'ledger-suit', 'V2-D06', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'BANK-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-010', 'ledger-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-010', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-010', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-010', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-010', 'ledger-suit', 'V2-D08', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'FA-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-011', 'ledger-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-011', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-011', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-011', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-011', 'V2-IMP-007', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-011', 'ledger-suit', 'V2-D09', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'DIM-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'DIM-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'DIM-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'DIM-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'DIM-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'DIM-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'DIM-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-012', 'ledger-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-012', 'V2-IMP-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-012', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-012', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-012', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-012', 'ledger-suit', 'V2-D10', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'TAX-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'TAX-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'TAX-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'TAX-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'TAX-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'TAX-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'TAX-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-013', 'ledger-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-013', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-013', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-013', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-013', 'ledger-suit', 'V2-D11', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'INV-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-014', 'ledger-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-014', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-014', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-014', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-014', 'ledger-suit', 'V2-D12', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'CORE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'COA-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'JRN-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'JRN-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'FS-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('V2-IMP-015', 'ledger-suit', 'VAL-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-003', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-004', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-005', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-006', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-007', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-008', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-009', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-010', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-011', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-012', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-013', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('V2-IMP-015', 'V2-IMP-014', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('V2-IMP-015', 'ledger-suit', 'V2-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PAY-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PAY-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PAY-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PAY-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'PAY-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'STOCK-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'VAL-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'VAL-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-PUR-002', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-PUR-002', 'SS-PAY-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-PUR-002', 'shop-suit', 'PUR-D04', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'STOCK-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'SAFE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'VAL-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'VAL-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'VAL-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-STOCK-002', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-STOCK-002', 'SS-SALE-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-STOCK-002', 'SS-PUR-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'CUST-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'CUST-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'STOCK-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'STOCK-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'STOCK-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'STOCK-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SET-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SET-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SET-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SET-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SAFE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SAFE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'VAL-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'VAL-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SALE-002', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-SALE-002', 'SS-PAY-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-SALE-002', 'SS-STOCK-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SALE-002', 'shop-suit', 'SALE-D04', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'BIZ-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'SERV-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'SERV-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'SERV-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'STOCK-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'STOCK-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'STOCK-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'STOCK-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'STOCK-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'STOCK-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'VAL-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'VAL-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SERV-002', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-SERV-002', 'SS-SALE-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-SERV-002', 'SS-STOCK-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SERV-002', 'shop-suit', 'SERV-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SERV-002', 'shop-suit', 'SERV-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SERV-002', 'shop-suit', 'SERV-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'PAY-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'SAFE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'SAFE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'UX-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'UX-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'UX-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'UX-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'UX-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'UX-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'UX-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'VAL-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-EXP-002', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-EXP-002', 'SS-SAFE-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-EXP-002', 'shop-suit', 'EXP-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEN-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEN-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEN-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'TEN-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'SAFE-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'SAFE-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'SAFE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'SAFE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'SAFE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'VAL-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-TEAM-001', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-TEAM-001', 'SS-PUR-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-TEAM-001', 'SS-SALE-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-TEAM-001', 'SS-PAY-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-TEAM-001', 'shop-suit', 'TEAM-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'RPT-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'UX-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'UX-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'UX-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'UX-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'UX-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'UX-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'SAFE-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-RPT-001', 'shop-suit', 'VAL-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-RPT-001', 'SS-PUR-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-RPT-001', 'SS-STOCK-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-RPT-001', 'SS-SALE-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-RPT-001', 'SS-EXP-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-RPT-001', 'SS-TEAM-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SAFE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'VAL-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SUB-001', 'shop-suit', 'VAL-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-SUB-001', 'SS-TEAM-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'TEAM-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-D04', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-D05', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-D06', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SUB-001', 'shop-suit', 'SUB-D07', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SET-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SET-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SET-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SET-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SET-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SAFE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'UX-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'UX-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'UX-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'UX-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'UX-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'UX-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-SET-001', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-SET-001', 'SS-SALE-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-SET-001', 'SS-PAY-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SET-001', 'shop-suit', 'SET-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SET-001', 'shop-suit', 'SET-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SET-001', 'shop-suit', 'SET-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('SS-SET-001', 'shop-suit', 'SALE-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'UX-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'TEN-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-UX-001', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-PUR-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-STOCK-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-SALE-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-EXP-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-TEAM-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-RPT-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-SUB-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-UX-001', 'SS-SET-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'VAL-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'PLAN-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'PLAN-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'PLAN-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'PLAN-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'PLAN-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'PLAN-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'SAFE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('SS-VAL-001', 'shop-suit', 'INT-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-PUR-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-STOCK-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-SALE-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-SERV-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-EXP-002', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-TEAM-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-RPT-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-SUB-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-SET-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('SS-VAL-001', 'SS-UX-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'TEN-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SCOPE-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SCOPE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SCOPE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TEN-001', 'inventory-suit', 'SAFE-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-TEN-001', 'IS-BOOT-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-TEN-001', 'inventory-suit', 'IS-D01', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ITEM-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'UOM-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'ETA-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'BAR-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'BAR-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'BAR-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ITEM-001', 'inventory-suit', 'BAR-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-ITEM-001', 'IS-TEN-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-ITEM-001', 'inventory-suit', 'IS-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'WH-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'WH-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'WH-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'WH-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'WH-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'WH-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'WH-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'LOC-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'SAFE-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-WH-001', 'inventory-suit', 'SAFE-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-WH-001', 'IS-ITEM-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-17') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'MOV-18') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'NEG-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'NEG-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'NEG-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'NEG-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'SAFE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'SAFE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'PERF-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'PERF-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'PERF-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'PERF-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'PERF-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'VAL-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'VAL-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'VAL-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'INT-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-STOCK-001', 'inventory-suit', 'INT-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-STOCK-001', 'IS-WH-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-STOCK-001', 'inventory-suit', 'IS-D07', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'TRACK-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'STATUS-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'STATUS-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'STATUS-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'STATUS-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'STATUS-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'BAR-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRACK-001', 'inventory-suit', 'VAL-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-TRACK-001', 'IS-STOCK-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-TRACK-001', 'inventory-suit', 'IS-D03', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'RECV-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'BAR-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'SAFE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RECV-001', 'inventory-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-RECV-001', 'IS-TRACK-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'ISSUE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'NEG-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'NEG-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'NEG-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ISSUE-001', 'inventory-suit', 'BAR-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-ISSUE-001', 'IS-RECV-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-ISSUE-001', 'inventory-suit', 'IS-D04', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-TRF-001', 'inventory-suit', 'TRF-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-TRF-001', 'IS-ISSUE-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'RES-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'NEG-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'NEG-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RES-001', 'inventory-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-RES-001', 'IS-TRF-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'COUNT-17') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COUNT-001', 'inventory-suit', 'BAR-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-COUNT-001', 'IS-RES-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'ADJ-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'STATUS-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'STATUS-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'STATUS-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'STATUS-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-ADJ-001', 'inventory-suit', 'STATUS-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-ADJ-001', 'IS-COUNT-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'COST-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'NRV-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'NRV-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'NRV-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'NRV-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'NRV-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'NRV-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-COST-001', 'inventory-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-COST-001', 'IS-ADJ-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-COST-001', 'inventory-suit', 'IS-D02', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-COST-001', 'inventory-suit', 'IS-D10', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-LOCK-001', 'inventory-suit', 'LOCK-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-LOCK-001', 'IS-COST-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-REP-001', 'inventory-suit', 'REP-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-REP-001', 'IS-LOCK-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'IMP-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'OPEN-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'OPEN-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'OPEN-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'OPEN-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'OPEN-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'OPEN-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-IMP-001', 'inventory-suit', 'OPEN-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-IMP-001', 'IS-REP-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-IMP-001', 'inventory-suit', 'IS-D09', true) ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'RPT-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'PERF-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'PERF-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'PERF-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-RPT-001', 'inventory-suit', 'PERF-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-RPT-001', 'IS-IMP-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'INT-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'VAL-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-INT-001', 'inventory-suit', 'VAL-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-INT-001', 'IS-RPT-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'SAFE-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'PERF-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'PERF-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'PERF-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'PERF-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'PERF-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'PERF-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'PERF-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-SAFE-001', 'inventory-suit', 'VAL-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-SAFE-001', 'IS-INT-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'UI-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-09') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-10') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-11') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-12') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-13') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-14') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-15') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'SAFE-16') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-01') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-02') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-03') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-04') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-05') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-07') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'VAL-08') ON CONFLICT DO NOTHING;
INSERT INTO control.task_requirements (task_id, suit_slug, requirement_id) VALUES ('IS-VER-001', 'inventory-suit', 'NRV-06') ON CONFLICT DO NOTHING;
INSERT INTO control.task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES ('IS-VER-001', 'IS-SAFE-001', 'hard') ON CONFLICT DO NOTHING;
INSERT INTO control.task_decisions (task_id, suit_slug, decision_id, blocking) VALUES ('IS-VER-001', 'inventory-suit', 'IS-D12', true) ON CONFLICT DO NOTHING;

INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'LS-V2-BASELINE-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'LS-V2-BASELINE-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-002', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-002'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-VER-002A', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-VER-002A'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-003', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-003'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-004', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-004'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-005', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-005'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-006', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-006'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-007', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-007'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-008', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-008'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-009', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-009'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-010', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-010'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-011', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-011'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-012', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-012'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-013', 'handoff_imported', NULL, 'blocked', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-013'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-014', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-014'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'V2-IMP-015', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"ledger-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'V2-IMP-015'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-BASE-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-BASE-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-BASE-CHK-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-BASE-CHK-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-BIZ-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-BIZ-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-PR-CHAIN-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-PR-CHAIN-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-WORKFLOW-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-WORKFLOW-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-WORKFLOW-001-R1', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-WORKFLOW-001-R1'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-SAFE-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-SAFE-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-CUST-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-CUST-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-SALE-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-SALE-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-PAY-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-PAY-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-PUR-002', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-PUR-002'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-STOCK-002', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-STOCK-002'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-SALE-002', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-SALE-002'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-SERV-002', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-SERV-002'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-EXP-002', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-EXP-002'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-TEAM-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-TEAM-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-RPT-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-RPT-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-SUB-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-SUB-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-SET-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-SET-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-UX-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-UX-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'SS-VAL-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"shop-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'SS-VAL-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-BASE-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-BASE-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-BOOT-001', 'handoff_imported', NULL, 'complete', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-BOOT-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-TEN-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-TEN-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-ITEM-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-ITEM-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-WH-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-WH-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-STOCK-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-STOCK-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-TRACK-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-TRACK-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-RECV-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-RECV-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-ISSUE-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-ISSUE-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-TRF-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-TRF-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-RES-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-RES-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-COUNT-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-COUNT-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-ADJ-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-ADJ-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-COST-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-COST-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-LOCK-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-LOCK-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-REP-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-REP-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-IMP-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-IMP-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-RPT-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-RPT-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-INT-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-INT-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-SAFE-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-SAFE-001'
    AND event_type = 'handoff_imported'
);
INSERT INTO control.task_events (task_id, event_type, from_status, to_status, source, payload)
SELECT 'IS-VER-001', 'handoff_imported', NULL, 'planned', 'chatgpt', '{"handoff_source":"inventory-suit.json","normalized_import":"2026-09-24"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM control.task_events
  WHERE task_id = 'IS-VER-001'
    AND event_type = 'handoff_imported'
);

COMMIT;

\echo '--- Import summary ---'
SELECT suit_slug, status, count(*) AS tasks
FROM control.tasks
WHERE suit_slug IN ('ledger-suit','shop-suit','inventory-suit')
GROUP BY suit_slug, status
ORDER BY suit_slug, status;

\echo '--- Next ready task per Suit ---'
SELECT 'ledger-suit' AS suit, task_id, title, status
FROM control.next_ready_task('ledger-suit')
UNION ALL
SELECT 'shop-suit', task_id, title, status
FROM control.next_ready_task('shop-suit')
UNION ALL
SELECT 'inventory-suit', task_id, title, status
FROM control.next_ready_task('inventory-suit');

\echo '--- Remaining blocked tasks ---'
SELECT task_id, suit_slug, title, status
FROM control.tasks
WHERE suit_slug IN ('ledger-suit','shop-suit','inventory-suit')
  AND status = 'blocked'
ORDER BY suit_slug, sequence;