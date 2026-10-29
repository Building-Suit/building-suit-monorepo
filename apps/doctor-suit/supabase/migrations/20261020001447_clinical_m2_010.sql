-- DOS-M2-010: synthetic implementation only; no fixture grants or clinical approval seeded.
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
 perform doctor_private.clinical_shape(p_value->'note',array['template_id','template_version','sections']);
 if jsonb_typeof(p_value#>'{note,template_version}')<>'number' or (p_value#>>'{note,template_version}')!~'^[1-9][0-9]{0,5}$' then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_TEMPLATE_INVALID';end if;
 select t.sections into definition from public.clinical_note_templates t where t.template_id=p_value#>>'{note,template_id}' and t.version=(p_value#>>'{note,template_version}')::integer;
 if definition is null or jsonb_typeof(p_value#>'{note,sections}') is distinct from 'array' or jsonb_array_length(p_value#>'{note,sections}')<>jsonb_array_length(definition) then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_TEMPLATE_INVALID';end if;
 seen:='{}';
 for item in select value from jsonb_array_elements(p_value#>'{note,sections}') loop
  perform doctor_private.clinical_shape(item,array['key','text']);
  if item->>'key'=any(seen) or not exists(select 1 from jsonb_array_elements(definition) d where d->>'key'=item->>'key') then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_TEMPLATE_INVALID';end if;
  perform doctor_private.clinical_text(item->'text',10000,not p_finalize or not exists(select 1 from jsonb_array_elements(definition) d where d->>'key'=item->>'key' and d->>'required'='true'));
  seen:=array_append(seen,item->>'key');
 end loop;
 for item in select value from jsonb_array_elements(p_value->'prescriptions') loop
  perform doctor_private.clinical_shape(item,array['id','medicine','dose','start_date','end_date','segments','instructions']);
  perform doctor_private.clinical_shape(item->'medicine',array['identity','label','provenance','source_version','strength','form']);
  perform doctor_private.clinical_medicine(item->'medicine');
  foreach keys slice 1 in array array[array['identity'],array['label'],array['strength'],array['form']] loop
   perform doctor_private.clinical_text(item->'medicine'->keys[1],200);
  end loop;
  perform doctor_private.clinical_shape(item->'dose',array['amount','unit','route']);
  perform doctor_private.clinical_text(item#>'{dose,amount}',30);
  if (item#>>'{dose,amount}')!~'^[0-9]{1,12}(\.[0-9]{1,6})?$' or (item#>>'{dose,amount}')::numeric<=0 then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  perform doctor_private.clinical_text(item#>'{dose,unit}',80);perform doctor_private.clinical_text(item#>'{dose,route}',120);
  perform doctor_private.clinical_text(item->'instructions',4000);
  if coalesce(item->>'start_date','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(item->>'end_date','')!~'^\d{4}-\d{2}-\d{2}$' then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  s:=(item->>'start_date')::date;e:=(item->>'end_date')::date;
  if e<s or jsonb_typeof(item->'segments') is distinct from 'array' or jsonb_array_length(item->'segments') not between 1 and 16 then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
  for segment in select value from jsonb_array_elements(item->'segments') loop
   perform doctor_private.clinical_shape(segment,array['kind','start_date','end_date','timezone','interval_minutes','weekdays','times','instructions']);
   if coalesce(segment->>'kind','')<>all(array['interval','weekdays','as_needed'])
    or coalesce(segment->>'start_date','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(segment->>'end_date','')!~'^\d{4}-\d{2}-\d{2}$'
    or not exists(select 1 from pg_catalog.pg_timezone_names where name=segment->>'timezone') then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
   if (segment->>'start_date')::date<s or (segment->>'end_date')::date>e or (segment->>'end_date')::date<(segment->>'start_date')::date then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
   perform doctor_private.clinical_text(segment->'instructions',1000);
   if jsonb_typeof(segment->'weekdays') is distinct from 'array' or jsonb_typeof(segment->'times') is distinct from 'array'
    or jsonb_array_length(segment->'weekdays')>7 or jsonb_array_length(segment->'times')>24 then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
   if exists(select 1 from jsonb_array_elements(segment->'weekdays') v where jsonb_typeof(v)<>'number' or v::text!~'^[1-7]$')
    or exists(select 1 from jsonb_array_elements(segment->'times') v where jsonb_typeof(v)<>'string' or (v#>>'{}')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$')
    or (select count(distinct v) from jsonb_array_elements(segment->'weekdays') v)<>jsonb_array_length(segment->'weekdays')
    or (select count(distinct v) from jsonb_array_elements(segment->'times') v)<>jsonb_array_length(segment->'times') then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
   if segment->>'kind'='interval' then
    if jsonb_typeof(segment->'interval_minutes') is distinct from 'number' or coalesce(segment->>'interval_minutes','')!~'^[1-9][0-9]{0,5}$' or (segment->>'interval_minutes')::integer>525600
     or jsonb_array_length(segment->'weekdays')<>0 or jsonb_array_length(segment->'times')<>1 then
     raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
   elsif segment->>'kind'='weekdays' then
    if segment->'interval_minutes'<>'null'::jsonb or jsonb_array_length(segment->'weekdays')=0 or jsonb_array_length(segment->'times')=0 then
     raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
   elsif segment->'interval_minutes'<>'null'::jsonb or jsonb_array_length(segment->'weekdays')<>0 or jsonb_array_length(segment->'times')<>0 then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_INVALID';end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(item->'segments') with ordinality a(v,n),jsonb_array_elements(item->'segments') with ordinality b(v,n)
    where a.n<b.n and (a.v->>'start_date')::date<=(b.v->>'end_date')::date and (b.v->>'start_date')::date<=(a.v->>'end_date')::date) then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_SCHEDULE_OVERLAP';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_value->'orders') loop
  perform doctor_private.clinical_shape(item,array['id','kind','request','due_at','state','reason']);
  if coalesce(item->>'kind','')<>all(array['follow_up','lab','imaging','referral']) or coalesce(item->>'state','')<>all(array['requested','tracking','cancelled']) then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  perform doctor_private.clinical_text(item->'request',4000);perform doctor_private.clinical_text(item->'reason',500,item->>'state'<>'cancelled');
  if item->'due_at'<>'null'::jsonb then
   if (item->>'due_at')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
   perform (item->>'due_at')::timestamptz;
  end if;
  perform doctor_private.clinical_scope(p_practice,p_location,'review');
 end loop;
 if p_value->'results'<>'[]'::jsonb then raise exception using errcode='22023',message='DOCTOR_CLINICAL_FIELD_UNAVAILABLE';end if;
 return p_value;
end $$;
