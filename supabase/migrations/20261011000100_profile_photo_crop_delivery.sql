create or replace function private.can_read_agent_profile_photo(p_organization_id uuid, p_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.transactions transaction
    where transaction.organization_id = p_organization_id
      and transaction.assigned_agent_id = p_agent_id
      and private.has_portal_access(
        transaction.id,
        array['seller','co_owner','accepted_buyer']::public.party_role[]
      )
  );
$$;

revoke all on function private.can_read_agent_profile_photo(uuid, uuid) from public, anon;
grant execute on function private.can_read_agent_profile_photo(uuid, uuid) to authenticated;

drop policy if exists agency_assets_customer_agent_read on storage.objects;
create policy agency_assets_customer_agent_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agency-assets'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[3] = 'profiles'
  and private.can_read_agent_profile_photo(
    (storage.foldername(name))[2]::uuid,
    (storage.foldername(name))[4]::uuid
  )
);

create or replace function public.customer_agent_profile(p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_portal_access(
    p_transaction_id,
    array['seller','co_owner','accepted_buyer']::public.party_role[]
  ) then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', profile.id,
    'name', profile.display_name,
    'title', profile.professional_title,
    'phone', profile.phone,
    'email', profile.email,
    'profile_photo_path', profile.profile_photo_path,
    'profile_updated_at', profile.updated_at
  )
  into v_result
  from public.transactions transaction
  join public.profiles profile on profile.id = transaction.assigned_agent_id
  where transaction.id = p_transaction_id;

  return v_result;
end;
$$;

revoke all on function public.customer_agent_profile(uuid) from public, anon;
grant execute on function public.customer_agent_profile(uuid) to authenticated;
