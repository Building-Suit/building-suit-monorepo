-- A dedicated source makes exceptional Control adjustments distinguishable in
-- the existing Journal Center. This label never grants posting authority: the
-- Control-account trigger accepts only a private server-set posting context.
alter type public.transaction_source add value 'control_adjustment';
