-- DOS-M2-005: synthetic implementation only; no fixture grants or clinical approval seeded.
create function doctor_private.clinical_medicine(p_value jsonb) returns void
language plpgsql immutable security definer set search_path='' as $$begin
 perform doctor_private.clinical_shape(p_value,array['identity','label','provenance','source_version','strength','form']);
 if p_value->>'provenance' is distinct from 'synthetic_manual' or p_value->>'source_version' is distinct from 'manual-synthetic-v1' then
 raise exception using errcode='22023',message='DOCTOR_CLINICAL_CATALOGUE_UNAVAILABLE';end if;
end $$;
revoke all on function doctor_private.clinical_medicine(jsonb) from public,anon,authenticated,service_role;
