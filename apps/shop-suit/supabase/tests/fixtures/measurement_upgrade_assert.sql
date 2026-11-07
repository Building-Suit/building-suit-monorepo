do $$declare f measurement_upgrade_fixture;begin
 select * into strict f from measurement_upgrade_fixture;
 if pg_temp.measurement_upgrade_snapshot(f.shop_id) is distinct from f.before_snapshot then
  raise exception 'Measurement upgrade rewrote historical stock/financial/service snapshots';end if;
 if (select base_unit_code from public.products where id=f.gram_id)<>'g'
 or (select base_unit_code from public.products where id=f.ml_id)<>'ml'
 or (select measurement_status from public.products where id=f.product_id)<>'legacy'
 or (select quantity_on_hand from public.product_stock where product_id=f.product_id)<>88 then
  raise exception 'Legacy semantics or service units changed on upgrade';end if;
 begin
  perform public.prepare_product_measurement(f.shop_id,f.product_id,'m','0.01','Unsafe historical relabel');
  raise exception 'Historical relabel unexpectedly succeeded';
 exception when sqlstate '55000' then
  if sqlerrm<>'MEASUREMENT_REQUIRES_UNUSED_PRODUCT' then raise;end if;
 end;
end;$$;
