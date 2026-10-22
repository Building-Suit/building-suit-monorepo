-- Keep base tables private; scope this owner-executed view before caller filters.
-- current_user is the invoking SQL role for a view, unlike SECURITY DEFINER functions.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE VIEW app_finance.account_hold_totals
WITH (security_barrier=true,security_invoker=false) AS
 SELECT a.id AS account_id,
    a.user_id,
    ( SELECT COALESCE(sum(nt.amount_minor), 0::numeric)::bigint AS "coalesce"
           FROM app_finance.network_transfers nt
          WHERE nt.sender_source_account_id = a.id AND nt.sender_user_id = a.user_id AND nt.status = 'pending'::app_finance.network_transfer_status) AS pending_transfer_hold_minor,
    ( SELECT COALESCE(sum(h.amount_minor), 0::numeric)::bigint AS "coalesce"
           FROM app_finance.held_amounts h
          WHERE h.account_id = a.id AND h.user_id = a.user_id AND h.settled_on IS NULL AND h.direction = 'i_owe'::app_finance.held_amount_direction) AS held_outgoing_minor,
    ( SELECT COALESCE(sum(h.amount_minor), 0::numeric)::bigint AS "coalesce"
           FROM app_finance.held_amounts h
          WHERE h.account_id = a.id AND h.user_id = a.user_id AND h.settled_on IS NULL AND h.direction = 'owed_to_me'::app_finance.held_amount_direction) AS held_incoming_minor
   FROM app_finance.accounts a
  WHERE a.user_id = (SELECT auth.uid()) OR ((SELECT auth.uid()) IS NULL AND current_user IN ('postgres','service_role'));
NOTIFY pgrst,'reload schema';
COMMIT;
