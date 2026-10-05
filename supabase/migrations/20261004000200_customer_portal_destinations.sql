create function public.customer_portal_destinations()
returns table (
  transaction_id uuid,
  role public.party_role,
  address text,
  postal_code text,
  municipality text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  return query
  select
    grant_row.transaction_id,
    grant_row.role,
    property.address_line,
    property.postal_code,
    property.municipality
  from public.portal_access_grants grant_row
  join public.transactions transaction
    on transaction.id = grant_row.transaction_id
    and transaction.organization_id = grant_row.organization_id
  join public.properties property
    on property.id = transaction.property_id
    and property.organization_id = grant_row.organization_id
  where grant_row.user_id = auth.uid()
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.role in ('seller', 'co_owner', 'accepted_buyer')
  order by grant_row.activated_at desc, grant_row.created_at desc, grant_row.id;
end;
$$;

revoke all on function public.customer_portal_destinations() from public, anon;
grant execute on function public.customer_portal_destinations() to authenticated;

comment on function public.customer_portal_destinations() is
  'Returns only the authenticated customer active portal grants with the minimum property data needed for routing and portal selection.';
