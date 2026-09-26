-- V2-IMP-004: a machine-readable source is required so historical P&L can
-- exclude only the system closing journal without hiding it from the ledger.
alter type public.transaction_source add value if not exists 'year_end_close';
