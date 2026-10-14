-- Exact timing predicate tests, with explicit timestamps and no clock mutation.
DO $$declare at timestamptz:='2026-10-13T12:00:00Z';begin
 if not shop_private.proration_window_valid('quoted',at+interval '15 minutes',at,null,null) then raise exception 'Fresh admission denied';end if;
 if shop_private.proration_window_valid('quoted',at+interval '15 minutes',at+interval '15 minutes',null,null) then raise exception 'Admission deadline not strict';end if;
 if shop_private.proration_window_valid('quoted',at+interval '15 minutes',at+interval '15 minutes 1 microsecond',at,30) then raise exception 'Expired unaccepted/credit quote admitted';end if;
 if not shop_private.proration_window_valid('checkout',at+interval '15 minutes',at+interval '35 minutes',at,30) then raise exception 'Accepted verification boundary denied';end if;
 if shop_private.proration_window_valid('checkout',at+interval '15 minutes',at+interval '35 minutes 1 microsecond',at,30) then raise exception 'Accepted verification deadline extended';end if;
 if not shop_private.proration_window_valid('requires_review',at+interval '15 minutes',at+interval '34 minutes',at,30) then raise exception 'Timely retained observation review denied';end if;
 if shop_private.proration_window_valid('checkout',at+interval '15 minutes',at+interval '20 minutes',at+interval '15 minutes 1 microsecond',30) then raise exception 'Order started after quote expiry admitted';end if;
 if shop_private.proration_window_valid('checkout',at+interval '15 minutes',at+interval '20 minutes',at,60) then raise exception 'Unsupported longer provider lifetime admitted';end if;
 if shop_private.proration_window_valid('checkout',at+interval '15 minutes',at+interval '20 minutes',null,30) then raise exception 'Missing accepted order admitted';end if;
 if shop_private.proration_window_valid('checkout',at+interval '15 minutes',at+interval '20 minutes',at,null) then raise exception 'Unprepared provider request admitted';end if;
 if shop_private.proration_window_valid('abandoned',at+interval '15 minutes',at+interval '20 minutes',at,30) then raise exception 'Abandoned quote revived after admission expiry';end if;
 if has_function_privilege('authenticated','shop_private.proration_window_valid(text,timestamptz,timestamptz,timestamptz,integer)','execute') or has_function_privilege('service_role','shop_private.proration_window_valid(text,timestamptz,timestamptz,timestamptz,integer)','execute') then raise exception 'Private predicate exposed';end if;
end $$;
