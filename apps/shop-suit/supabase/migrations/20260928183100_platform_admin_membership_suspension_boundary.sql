-- SS-ADMIN-001: the self-read branch must observe the same active tenant
-- boundary as owner reads. Preserve the existing owner/self visibility rules.
alter policy membership_self_or_owner_read on public.shop_memberships
  using (
    shop_private.is_member(shop_id)
    and (
      shop_private.is_owner(shop_id) or exists (
        select 1 from public.profiles profile
        where profile.id = shop_memberships.profile_id
          and profile.user_id = (select auth.uid())
      )
    )
  );
