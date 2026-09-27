-- LS-OPS-001 read-only restore evidence.
--
-- Run with psql -X -Atq -v ON_ERROR_STOP=1 and supply:
--   environment_id, organization_id, actor_id, from_date, to_date
--
-- The actor must be a member with the same report/audit capabilities in both
-- isolated instances. The output is one JSON object. All counts and money
-- totals are text so downstream tooling never coerces PostgreSQL bigint values
-- through a JavaScript Number.
\set ON_ERROR_STOP on
begin read only;

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', :'actor_id', 'role', 'authenticated')::text,
  true
) as claims \gset
set local role authenticated;

select jsonb_build_object(
  'schema_version', 'ls-ops-001-v1',
  'environment_id', :'environment_id',
  'organization_id', :'organization_id',
  'from_date', :'from_date',
  'to_date', :'to_date',
  'ledger', jsonb_build_object(
    'journals', (
      select count(*)::text
      from public.transactions
      where organization_id = :'organization_id'::uuid
    ),
    'entries', (
      select count(*)::text
      from public.transaction_entries
      where organization_id = :'organization_id'::uuid
    ),
    'posted_debits_minor', (
      select coalesce(sum(base_amount_minor), 0)::text
      from public.transaction_entries
      where organization_id = :'organization_id'::uuid
        and posted_at is not null
        and side = 'debit'
    ),
    'posted_credits_minor', (
      select coalesce(sum(base_amount_minor), 0)::text
      from public.transaction_entries
      where organization_id = :'organization_id'::uuid
        and posted_at is not null
        and side = 'credit'
    ),
    'unbalanced_journals', (
      select count(*)::text
      from (
        select transaction_id
        from public.transaction_entries
        where organization_id = :'organization_id'::uuid
          and posted_at is not null
        group by transaction_id
        having sum(
          case when side = 'debit' then base_amount_minor else -base_amount_minor end
        ) <> 0
      ) imbalance
    ),
    'posted_identity_digest', (
      select md5(coalesce(string_agg(jsonb_build_array(
        id, transaction_date, posting_date, type, source, status,
        journal_reference, reference, currency_code, exchange_rate, posted_at,
        reverses_transaction_id, reversed_by_transaction_id,
        correction_of_transaction_id, idempotency_key
      )::text, E'\n' order by id), ''))
      from public.transactions
      where organization_id = :'organization_id'::uuid
        and posted_at is not null
    ),
    'posted_entry_digest', (
      select md5(coalesce(string_agg(jsonb_build_array(
        id, transaction_id, account_id, entry_index, side, amount_minor::text,
        currency_code, base_amount_minor::text, base_currency_code,
        exchange_rate, entry_date, posted_at, memo, dimensions
      )::text, E'\n' order by id), ''))
      from public.transaction_entries
      where organization_id = :'organization_id'::uuid
        and posted_at is not null
    )
  ),
  'reports', jsonb_build_object(
    'trial_balance_digest', (
      select md5(coalesce(string_agg(to_jsonb(report)::text, E'\n'
        order by account_id), ''))
      from public.report_trial_balance(
        :'organization_id'::uuid, :'from_date'::date, :'to_date'::date
      ) report
    ),
    'balance_sheet_digest', (
      select md5(coalesce(string_agg(to_jsonb(report)::text, E'\n'
        order by section, account_id nulls last), ''))
      from public.report_balance_sheet(
        :'organization_id'::uuid, :'to_date'::date
      ) report
    ),
    'profit_loss_digest', (
      select md5(coalesce(string_agg(to_jsonb(report)::text, E'\n'
        order by section, account_id), ''))
      from public.report_profit_and_loss(
        :'organization_id'::uuid, :'from_date'::date, :'to_date'::date
      ) report
    ),
    'control_reconciliation_digest', (
      select md5(coalesce(string_agg(to_jsonb(report)::text, E'\n'
        order by control_account_id), ''))
      from public.reconcile_control_accounts(
        :'organization_id'::uuid, :'to_date'::date
      ) report
    ),
    'profit_loss_csv_digest', md5(public.export_financial_report_csv(
      :'organization_id'::uuid, 'profit_loss',
      :'from_date'::date, :'to_date'::date
    )),
    'balance_sheet_csv_digest', md5(public.export_financial_report_csv(
      :'organization_id'::uuid, 'balance_sheet',
      p_as_of_date => :'to_date'::date
    )),
    'trial_balance_csv_digest', md5(public.export_financial_report_csv(
      :'organization_id'::uuid, 'trial_balance',
      :'from_date'::date, :'to_date'::date
    )),
    'cash_flow_csv_digest', md5(public.export_financial_report_csv(
      :'organization_id'::uuid, 'cash_flow',
      :'from_date'::date, :'to_date'::date
    ))
  ),
  'configuration', jsonb_build_object(
    'organization_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.organizations row_value
      where id = :'organization_id'::uuid
    ),
    'settings_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.organization_id), ''))
      from public.organization_settings row_value
      where organization_id = :'organization_id'::uuid
    ),
    'accounts_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.accounts row_value
      where organization_id = :'organization_id'::uuid
    ),
    'categories_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.categories row_value
      where organization_id = :'organization_id'::uuid
    ),
    'counterparties_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.counterparties row_value
      where organization_id = :'organization_id'::uuid
    ),
    'control_bindings_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.account_id), ''))
      from public.control_account_bindings row_value
      where organization_id = :'organization_id'::uuid
    ),
    'dimension_values_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.accounting_dimension_values row_value
      where organization_id = :'organization_id'::uuid
    ),
    'dimension_policies_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.account_id, row_value.kind), ''))
      from public.account_dimension_policies row_value
      where organization_id = :'organization_id'::uuid
    )
  ),
  'preserved_operations', jsonb_build_object(
    'recurring_rules_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.recurring_rules row_value
      where organization_id = :'organization_id'::uuid
    ),
    'recurring_occurrences_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.recurring_occurrences row_value
      where organization_id = :'organization_id'::uuid
    ),
    'import_batches_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.import_batches row_value
      where organization_id = :'organization_id'::uuid
    ),
    'import_rows_digest', (
      select md5(coalesce(string_agg(to_jsonb(row_value)::text, E'\n'
        order by row_value.id), ''))
      from public.import_rows row_value
      where organization_id = :'organization_id'::uuid
    )
  ),
  'attachments', jsonb_build_object(
    'count', (
      select count(*)::text from public.attachments
      where organization_id = :'organization_id'::uuid
    ),
    'bytes', (
      select coalesce(sum(size_bytes), 0)::text from public.attachments
      where organization_id = :'organization_id'::uuid
    ),
    'metadata_digest', (
      select md5(coalesce(string_agg(jsonb_build_array(
        id, entity_type, entity_id, file_name, mime_type, size_bytes::text,
        storage_bucket, storage_key, checksum, uploaded_by, created_at
      )::text, E'\n' order by storage_bucket, storage_key), ''))
      from public.attachments
      where organization_id = :'organization_id'::uuid
    )
  )
);

rollback;
