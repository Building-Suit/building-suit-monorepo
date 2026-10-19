-- DOS-M2-003: synthetic implementation only; no fixture grants or clinical approval seeded.
create or replace function doctor_private.clinical_snapshot(p_value jsonb,p_practice uuid,p_location uuid,p_patient uuid,p_finalize boolean default false) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare item jsonb; segment jsonb; other jsonb; definition jsonb; seen text[]; s date; e date; keys text[];
begin
 perform doctor_private.clinical_shape(p_value,array['intake','note','prescriptions','orders','results']);
 if octet_length(p_value::text)>131072 then raise exception using errcode='22023',message='DOCTOR_CLINICAL_TOO_LARGE';end if;
 foreach keys slice 1 in array array[array['intake'],array['prescriptions'],array['orders'],array['results']] loop
  if jsonb_typeof(p_value->keys[1]) is distinct from 'array' or jsonb_array_length(p_value->keys[1])>100 then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  if exists(select 1 from jsonb_array_elements(p_value->keys[1]) x where jsonb_typeof(x)<>'object' or coalesce(x->>'id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   or (select count(distinct x->>'id') from jsonb_array_elements(p_value->keys[1]) x)<>jsonb_array_length(p_value->keys[1]) then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_value->'intake') loop
  perform doctor_private.clinical_shape(item,array['id','kind','knowledge','text','value','unit','source']);
  if coalesce(item->>'kind','')<>all(array['history','allergy','observation'])
   or coalesce(item->>'knowledge','')<>all(array['missing','unknown','none_reported','reported'])
   or coalesce(item->>'source','')<>all(array['patient','staff','clinician']) then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  perform doctor_private.clinical_text(item->'text',4000,true);
  perform doctor_private.clinical_text(item->'value',120,true);
  perform doctor_private.clinical_text(item->'unit',80,true);
  if item->>'knowledge'<>'reported' and ((item->>'text')<>'' or (item->>'value')<>'' or (item->>'unit')<>'') then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  if item->>'source'='clinician' then perform doctor_private.clinical_scope(p_practice,p_location,'review');end if;
 end loop;
 if p_value->'note' is distinct from '{"template_id":"synthetic-neutral","template_version":1,"sections":[{"key":"entered_note","text":""},{"key":"review_notes","text":""}]}'::jsonb then
 raise exception using errcode='22023',message='DOCTOR_CLINICAL_NOTE_UNAVAILABLE';end if;
 if p_value->'prescriptions'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 if p_value->'orders'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 if p_value->'results'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 return p_value;
end $$;
