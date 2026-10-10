BEGIN;
DO $amendment$
DECLARE original text; amended text; needle text := $needle$WHERE f->>'file' ~ '/supabase/migrations/[^/]+[.]sql$'$needle$;
BEGIN
 original:=pg_get_functiondef('control.operator_task_gate_snapshot(uuid)'::regprocedure);
 IF (length(original)-length(replace(original,needle,'')))/length(needle)<>1 THEN
  RAISE EXCEPTION 'protected_source_offer_baseline_mismatch';
 END IF;
 amended:=replace(original,needle,$replacement$WHERE f->>'file' ~ '/supabase/(migrations/[^/]+[.]sql|config[.]toml)$'$replacement$);
 amended:=replace(amended,'Protected migration file; draft publication does not execute SQL','Protected source file; Draft publication does not execute SQL or deploy configuration');
 EXECUTE amended;
END $amendment$;
COMMIT;
