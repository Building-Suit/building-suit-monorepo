BEGIN;

UPDATE control.decisions
SET metadata =
  metadata ||
  jsonb_build_object(
    'authoritative_regulatory_evidence_verified', true,
    'regulatory_evidence_verified_at', '2026-09-25',
    'jurisdiction', 'EG',
    'implementation_scope', 'standard_domestic_vat_accounting',
    'current_general_rate_percent', 14,
    'evidence_sources',
      jsonb_build_array(
        jsonb_build_object(
          'authority', 'Egyptian Tax Authority',
          'document', 'VAT Law No. 67 of 2016'
        ),
        jsonb_build_object(
          'authority', 'Egyptian Tax Authority',
          'document', 'Executive Regulations - Ministerial Decree No. 66 of 2017'
        ),
        jsonb_build_object(
          'authority', 'Egyptian Tax Authority',
          'document', 'VAT Law amendment No. 157 of 2025'
        ),
        jsonb_build_object(
          'authority', 'Egyptian Tax Authority',
          'document', 'Ministerial Decree No. 417 of 2025'
        ),
        jsonb_build_object(
          'authority', 'Egyptian Tax Authority',
          'document', 'VAT Law amendment No. 149 of 2026'
        )
      ),
    'accountant_acceptance_pending', true
  )
WHERE suit_slug = 'ledger-suit'
  AND decision_id = 'V2-D11';


UPDATE control.tasks
SET
  status = 'planned',

  model_profile = 'standard',

  description =
    'Implement bounded Egyptian VAT accounting using the approved V2-D11 policy and the verified regulatory evidence snapshot dated 2026-09-25. Initial implementation is limited to explicitly VAT-registered organizations and standard domestic taxable supplies under an effective-dated 14% VAT code. Implement output VAT, eligible input VAT, configurable VAT control accounts, tax-point/document dates, append-only credits/reversals and source-document-to-VAT-to-GL reconciliation. Do not infer registration liability or implement table tax, sector-specific/special rates, exemptions, zero-rated exports, reverse charge, foreign-currency VAT, refunds, government filing, e-invoice submission or e-receipt submission without separate authoritative scope.',

  metadata =
    metadata ||
    jsonb_build_object(
      'blocker_resolved', true,
      'blocker_resolved_at', '2026-09-25',
      'blocker_resolution',
        'Current authoritative Egyptian VAT evidence recorded and implementation scope bounded.',
      'jurisdiction', 'EG',
      'regulatory_snapshot_date', '2026-09-25',
      'vat_scope', 'standard_domestic_vat_accounting',
      'standard_rate_percent', 14,
      'model_routing_reason',
        'Regulatory interpretation is pre-bounded in task evidence; Codex implements explicit accounting policy rather than researching law.',
      'explicitly_out_of_scope',
        jsonb_build_array(
          'automatic VAT registration determination',
          'table tax',
          'crude-oil special treatment',
          'construction transitional rules',
          'medical/machinery special treatment',
          'automatic exemption classification',
          'zero-rated exports',
          'foreign-currency VAT',
          'reverse charge',
          'VAT refund claims',
          'ETA filing/submission',
          'e-invoice submission',
          'e-receipt submission'
        ),
      'accountant_acceptance_pending', true
    )

WHERE task_id = 'V2-IMP-013'
  AND suit_slug = 'ledger-suit'
  AND status = 'blocked';


INSERT INTO control.task_events (
  task_id,
  event_type,
  from_status,
  to_status,
  source,
  payload
)
SELECT
  'V2-IMP-013',
  'blocker_resolved',
  'blocked',
  'planned',
  'chatgpt',
  jsonb_build_object(
    'reason',
      'Authoritative Egyptian VAT regulatory evidence verified and first implementation scope explicitly bounded.',
    'snapshot_date',
      '2026-09-25',
    'jurisdiction',
      'EG',
    'general_vat_rate_percent',
      14,
    'accountant_acceptance_pending',
      true
  )
WHERE EXISTS (
  SELECT 1
  FROM control.tasks
  WHERE task_id = 'V2-IMP-013'
    AND status = 'planned'
);

COMMIT;
