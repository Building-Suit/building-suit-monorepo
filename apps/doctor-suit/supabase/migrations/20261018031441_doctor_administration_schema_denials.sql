-- Record authenticated schema/capability denials after the committed nonce.
-- Only audit labels widen; the executable three-read allowlist, grants and
-- unavailable operational binding/commands remain unchanged.
alter table public.doctor_administration_audit drop constraint doctor_administration_audit_operation_check;
alter table public.doctor_administration_audit add constraint doctor_administration_audit_operation_check
 check(operation='invalid_operation'or(length(operation)<=160 and operation~'^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'));
alter table public.doctor_administration_audit drop constraint doctor_administration_audit_outcome_check;
alter table public.doctor_administration_audit add constraint doctor_administration_audit_outcome_check
 check(outcome in('synthetic_read','operator_denied','target_denied','schema_denied'));
