-- Report exports acquire the plan-feature transition lock. Restore the
-- VOLATILE declaration lost when financial statement exports were replaced.
-- Signature, authorization and exported data are unchanged.
alter function public.export_financial_report_csv(uuid,text,date,date,date,uuid) volatile;
