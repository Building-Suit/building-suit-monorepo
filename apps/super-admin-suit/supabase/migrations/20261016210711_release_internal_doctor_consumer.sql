-- DOS-M1-002. Doctor is an internal synthetic consumer of the shared workspace.
-- This private provenance entry grants no operational/public registration, baseline,
-- navigation, capability, environment binding, provider access or release authority.
insert into super_admin_private.release_internal_consumers(stable_key)
values ('doctor-suit')
on conflict (stable_key) do nothing;
