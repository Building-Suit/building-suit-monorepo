do $$
declare policy jsonb:='{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"inclusive","subtype":"V009"},"items":[]}';
 s jsonb; line jsonb; first jsonb; second jsonb; third jsonb; net numeric; tax numeric; total numeric;
begin
 s:=shop_private.calculate_tax('[{"id":"a","quantity":1,"unitPrice":114,"lineDiscount":0}]',policy,0);
 if (s->>'net')::numeric<>100 or (s->>'tax')::numeric<>14 or (s->>'total')::numeric<>114 then raise exception 'Inclusive 114 failed: %',s; end if;
 s:=shop_private.calculate_tax('[{"id":"a","quantity":0.125,"unitPrice":114,"lineDiscount":1.25},{"id":"b","quantity":3,"unitPrice":0.01,"lineDiscount":0}]',policy,0.01);
 select sum((x->>'net')::numeric),sum((x->>'tax')::numeric),sum((x->>'total')::numeric) into net,tax,total from jsonb_array_elements(s->'lines')x;
 if net+tax<>total or total<>(s->>'total')::numeric then raise exception 'Conservation failed'; end if;
 if (select sum((x->>'orderDiscount5')::numeric) from jsonb_array_elements(s->'lines') x)<>0.01 then raise exception 'Discount allocation failed'; end if;
 s:=shop_private.calculate_tax('[{"id":"a","quantity":3,"unitPrice":0.01,"lineDiscount":0}]',policy,0);
 line:=s->'lines'->0;
 first:=shop_private.tax_return_components(line,1,0); second:=shop_private.tax_return_components(line,2,1); third:=shop_private.tax_return_components(line,3,2);
 if (first->>'total')::numeric+(second->>'total')::numeric+(third->>'total')::numeric<>(line->>'total')::numeric then raise exception 'Refund conservation failed'; end if;
 -- Later policy changes cannot affect original snapshot returns.
 policy:=jsonb_set(policy,'{default,rate}','20');
 if shop_private.tax_return_components(line,3,0)->>'total' is distinct from line->>'total' then raise exception 'Original refund changed'; end if;
 begin perform shop_private.validate_tax_rule('{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"Tbl01","taxType":"T2"}'); raise exception 'Unsupported ETA accepted'; exception when invalid_parameter_value then null; end;
 begin perform shop_private.calculate_tax('[{"quantity":1,"unitPrice":10,"lineDiscount":11}]',policy,0); raise exception 'Excess discount accepted'; exception when invalid_parameter_value then null; end;
 policy:='{"enabled":true,"default":{"treatment":"vat","rate":14,"priceMode":"exclusive","subtype":"V009"},"items":[{"itemType":"product","sourceId":"zero","treatment":"zero_rated","rate":0,"priceMode":"exclusive","subtype":"V001"},{"itemType":"service","sourceId":"exempt","treatment":"exempt","rate":0,"priceMode":"exclusive","subtype":"V003"},{"itemType":"product","sourceId":"outside","treatment":"non_taxable","rate":0,"priceMode":"exclusive","subtype":"V004"}]}';
 s:=shop_private.calculate_tax('[{"quantity":1,"unitPrice":100,"lineDiscount":0},{"itemType":"product","sourceId":"zero","quantity":1,"unitPrice":100,"lineDiscount":0},{"itemType":"service","sourceId":"exempt","quantity":1,"unitPrice":100,"lineDiscount":0},{"itemType":"product","sourceId":"outside","quantity":1,"unitPrice":100,"lineDiscount":0}]',policy,40);
 if (s->>'net')::numeric<>360 or (s->>'tax')::numeric<>12.60 or (s->>'total')::numeric<>372.60 then raise exception 'Mixed treatment/discount failed %',s; end if;
 s:=shop_private.calculate_tax('[{"quantity":1,"unitPrice":114,"lineDiscount":0}]',jsonb_set(policy,'{enabled}','false'),0);
 if (s->>'tax')::numeric<>0 or s->'lines'->0->'rule'<>'null'::jsonb or s->>'calculationEnabled'<>'false' then raise exception 'Disabled classified as exemption'; end if;
end; $$;
