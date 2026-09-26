-- Separate transaction: PostgreSQL enum values must commit before use.
alter type public.control_subledger_type add value 'inventory';
