create table public.portal_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null,
  role public.party_role not null,
  status text not null check (status in ('invited', 'active', 'revoked')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  constraint portal_access_grants_customer_role_check
    check (role in ('seller', 'co_owner', 'accepted_buyer')),
  constraint portal_access_grants_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint portal_access_grants_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint portal_access_grants_contact_id_fkey
    foreign key (contact_id) references public.contacts(id),
  constraint portal_access_grants_contact_org_fkey
    foreign key (contact_id, organization_id)
    references public.contacts(id, organization_id),
  constraint portal_access_grants_creator_membership_fkey
    foreign key (organization_id, created_by)
    references public.organization_memberships(organization_id, user_id),
  constraint portal_access_grants_status_timestamps_check check (
    (status = 'invited' and activated_at is null and revoked_at is null)
    or (status = 'active' and activated_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  ),
  unique (transaction_id, user_id, role)
);

create index portal_access_grants_user_active_idx
  on public.portal_access_grants (user_id, transaction_id, role)
  where status = 'active';
create index portal_access_grants_transaction_idx
  on public.portal_access_grants (transaction_id, status);

alter table public.portal_access_grants enable row level security;

create policy portal_access_grants_select_internal_members
on public.portal_access_grants for select to authenticated
using (private.is_org_member(organization_id));

revoke all on public.portal_access_grants from anon, authenticated;
grant select on public.portal_access_grants to authenticated;

create function private.has_portal_access(
  p_transaction_id uuid,
  p_roles public.party_role[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1
    from public.portal_access_grants grant_row
    where grant_row.transaction_id = p_transaction_id
      and grant_row.user_id = p_user_id
      and grant_row.role = any(p_roles)
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
  );
$$;

create function private.portal_contact_id(
  p_transaction_id uuid,
  p_roles public.party_role[],
  p_user_id uuid default auth.uid()
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select grant_row.contact_id
  from public.portal_access_grants grant_row
  where grant_row.transaction_id = p_transaction_id
    and grant_row.user_id = p_user_id
    and grant_row.role = any(p_roles)
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
  order by grant_row.activated_at desc
  limit 1;
$$;

revoke all on function private.has_portal_access(uuid, public.party_role[], uuid) from public, anon, authenticated;
revoke all on function private.portal_contact_id(uuid, public.party_role[], uuid) from public, anon, authenticated;

create function public.grant_portal_access(
  p_transaction_id uuid,
  p_user_id uuid,
  p_contact_id uuid,
  p_role public.party_role
)
returns public.portal_access_grants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_organization_id uuid;
  v_grant public.portal_access_grants%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_role not in ('seller', 'co_owner', 'accepted_buyer') then
    raise exception 'Role is not customer-safe' using errcode = '22023';
  end if;
  select organization_id into v_organization_id from public.transactions where id = p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Not authorized to grant portal access' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Portal user profile not found' using errcode = '23503';
  end if;
  if not exists (select 1 from public.contacts where id = p_contact_id and organization_id = v_organization_id) then
    raise exception 'Contact does not belong to transaction organization' using errcode = '23503';
  end if;
  if p_role in ('seller', 'co_owner') and not exists (
    select 1 from public.transaction_parties party
    where party.transaction_id = p_transaction_id
      and party.contact_id = p_contact_id
      and party.role = p_role
  ) then raise exception 'Seller contact is not a matching transaction party' using errcode = '42501'; end if;
  if p_role = 'accepted_buyer' and not exists (
    select 1 from public.offers offer
    where offer.transaction_id = p_transaction_id and offer.buyer_contact_id = p_contact_id
  ) then raise exception 'Buyer contact has no offer in this transaction' using errcode = '42501'; end if;

  insert into public.portal_access_grants (
    organization_id, transaction_id, user_id, contact_id, role, status,
    created_by, activated_at, revoked_at
  ) values (
    v_organization_id, p_transaction_id, p_user_id, p_contact_id, p_role,
    'active', v_actor, now(), null
  ) on conflict (transaction_id, user_id, role) do update set
    contact_id = excluded.contact_id,
    status = 'active',
    activated_at = now(),
    revoked_at = null,
    created_by = v_actor
  returning * into v_grant;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_organization_id, p_transaction_id, v_actor, 'portal_access_granted',
    'internal', 'Customer portal access granted',
    jsonb_build_object('grant_id', v_grant.id, 'user_id', p_user_id, 'contact_id', p_contact_id, 'role', p_role)
  );
  return v_grant;
end;
$$;

create function public.revoke_portal_access(p_grant_id uuid)
returns public.portal_access_grants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_grant public.portal_access_grants%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_grant from public.portal_access_grants where id = p_grant_id for update;
  if not found then raise exception 'Portal access grant not found' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(v_grant.transaction_id, v_actor) then
    raise exception 'Not authorized to revoke portal access' using errcode = '42501';
  end if;
  update public.portal_access_grants
  set status = 'revoked', revoked_at = now()
  where id = p_grant_id returning * into v_grant;
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_grant.organization_id, v_grant.transaction_id, v_actor,
    'portal_access_revoked', 'internal', 'Customer portal access revoked',
    jsonb_build_object('grant_id', v_grant.id, 'user_id', v_grant.user_id, 'role', v_grant.role)
  );
  return v_grant;
end;
$$;

revoke all on function public.grant_portal_access(uuid, uuid, uuid, public.party_role) from public, anon;
grant execute on function public.grant_portal_access(uuid, uuid, uuid, public.party_role) to authenticated;
revoke all on function public.revoke_portal_access(uuid) from public, anon;
grant execute on function public.revoke_portal_access(uuid) to authenticated;

create function public.seller_transaction_summary(p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not private.has_portal_access(p_transaction_id, array['seller', 'co_owner']::public.party_role[]) then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'transaction_id', t.id, 'stage', t.stage, 'asking_price_isk', t.asking_price_isk,
    'property', jsonb_build_object('address', p.address_line, 'postal_code', p.postal_code, 'municipality', p.municipality, 'size_sqm', p.size_sqm, 'bedroom_count', p.bedroom_count, 'year_built', p.year_built),
    'agent', jsonb_build_object('name', agent.display_name, 'phone', agent.phone),
    'customer', jsonb_build_object('name', contact.full_name, 'phone', contact.phone, 'email', contact.email),
    'viewing_summary', jsonb_build_object(
      'registered', (select count(*) from public.viewing_guests guest join public.viewings viewing on viewing.id = guest.viewing_id where viewing.transaction_id = t.id),
      'attended', (select count(*) from public.viewing_guests guest join public.viewings viewing on viewing.id = guest.viewing_id where viewing.transaction_id = t.id and guest.attendance = 'attended'),
      'very_interested', (select count(*) from public.viewing_guests guest join public.viewings viewing on viewing.id = guest.viewing_id where viewing.transaction_id = t.id and guest.interest = 'very_interested')
    ),
    'activity', coalesce((select jsonb_agg(jsonb_build_object('summary', e.summary, 'created_at', e.created_at) order by e.created_at desc) from public.activity_events e where e.transaction_id = t.id and e.visibility in ('seller', 'seller_and_buyer')), '[]'::jsonb)
  ) into v_result
  from public.transactions t
  join public.properties p on p.id = t.property_id
  join public.profiles agent on agent.id = t.assigned_agent_id
  join public.contacts contact on contact.id = private.portal_contact_id(t.id, array['seller', 'co_owner']::public.party_role[])
  where t.id = p_transaction_id;
  return v_result;
end;
$$;

create function public.seller_offer_summary(p_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_offer public.offers%rowtype; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id;
  if not found or not private.has_portal_access(v_offer.transaction_id, array['seller', 'co_owner']::public.party_role[]) then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  if v_offer.sent_to_seller_at is null then raise exception 'Offer is not available to seller' using errcode = '42501'; end if;
  select jsonb_build_object(
    'id', o.id, 'status', o.status, 'amount_isk', o.amount_isk,
    'asking_price_isk', t.asking_price_isk, 'valid_until', o.valid_until,
    'requested_handover_date', o.requested_handover_date,
    'property', p.address_line, 'location', p.postal_code || ' ' || p.municipality,
    'agent', agent.display_name,
    'conditions', coalesce((select jsonb_agg(jsonb_build_object('type', c.condition_type, 'status', c.status, 'details', c.details) order by c.created_at) from public.offer_conditions c where c.offer_id = o.id), '[]'::jsonb),
    'latest_intent', (select r.intent from public.seller_offer_responses r where r.offer_id = o.id and r.seller_contact_id = private.portal_contact_id(o.transaction_id, array['seller', 'co_owner']::public.party_role[]) order by r.submitted_at desc, r.id desc limit 1)
  ) into v_result
  from public.offers o join public.transactions t on t.id = o.transaction_id
  join public.properties p on p.id = t.property_id
  join public.profiles agent on agent.id = t.assigned_agent_id
  where o.id = p_offer_id;
  return v_result;
end;
$$;

create function public.buyer_property_summary(p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_contact_id uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_contact_id := private.portal_contact_id(p_transaction_id, array['accepted_buyer']::public.party_role[]);
  if v_contact_id is null then raise exception 'Portal access denied' using errcode = '42501'; end if;
  select jsonb_build_object(
    'transaction_id', t.id, 'asking_price_isk', t.asking_price_isk,
    'property', jsonb_build_object('address', p.address_line, 'postal_code', p.postal_code, 'municipality', p.municipality, 'size_sqm', p.size_sqm, 'bedroom_count', p.bedroom_count, 'year_built', p.year_built),
    'agent', jsonb_build_object('name', agent.display_name, 'phone', agent.phone),
    'customer', jsonb_build_object('name', contact.full_name, 'phone', contact.phone, 'email', contact.email)
  ) into v_result
  from public.transactions t join public.properties p on p.id = t.property_id
  join public.profiles agent on agent.id = t.assigned_agent_id
  join public.contacts contact on contact.id = v_contact_id
  where t.id = p_transaction_id;
  return v_result;
end;
$$;

create function public.buyer_offer_status(p_offer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_offer public.offers%rowtype; v_contact_id uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(v_offer.transaction_id, array['accepted_buyer']::public.party_role[]);
  if v_contact_id is null or v_contact_id is distinct from v_offer.buyer_contact_id then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', o.id,
    'status', case when o.status = 'seller_intent_recorded' then 'sent_to_seller' else o.status::text end,
    'amount_isk', o.amount_isk, 'valid_until', o.valid_until,
    'requested_handover_date', o.requested_handover_date, 'submitted_at', o.submitted_at,
    'buyer_name', contact.full_name, 'buyer_phone', contact.phone, 'buyer_email', contact.email,
    'conditions', coalesce((select jsonb_agg(jsonb_build_object('type', c.condition_type, 'status', c.status, 'details', c.details) order by c.created_at) from public.offer_conditions c where c.offer_id = o.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('status', h.to_status, 'created_at', h.created_at) order by h.created_at) from public.offer_status_history h where h.offer_id = o.id and h.to_status <> 'seller_intent_recorded'), '[]'::jsonb)
  ) into v_result
  from public.offers o join public.contacts contact on contact.id = o.buyer_contact_id
  where o.id = p_offer_id;
  return v_result;
end;
$$;

create function public.save_buyer_offer_draft(
  p_offer_id uuid, p_amount_isk bigint, p_valid_until timestamptz,
  p_requested_handover_date date, p_conditions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_offer public.offers%rowtype; v_contact_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(v_offer.transaction_id, array['accepted_buyer']::public.party_role[]);
  if v_contact_id is null or v_contact_id is distinct from v_offer.buyer_contact_id then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  if v_offer.status not in ('draft', 'change_requested') then raise exception 'Offer is not editable' using errcode = '23514'; end if;
  if p_amount_isk <= 0 then raise exception 'Offer amount must be positive' using errcode = '22023'; end if;
  update public.offers set amount_isk = p_amount_isk, valid_until = p_valid_until,
    requested_handover_date = p_requested_handover_date, buyer_user_id = auth.uid()
  where id = p_offer_id;
  perform private.replace_offer_conditions(p_offer_id, p_conditions);
  insert into public.activity_events (organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata)
  values (v_offer.organization_id, v_offer.transaction_id, null, 'offer_draft_updated', 'buyer', 'Buyer updated offer draft', jsonb_build_object('offer_id', p_offer_id, 'buyer_user_id', auth.uid()));
  return public.buyer_offer_status(p_offer_id);
end;
$$;

-- Phase 3 allowed an owned offer to call submit_offer, but activity actors were
-- previously assumed to be organization members. Customer submissions retain
-- the profile actor in immutable offer history while the internal activity row
-- records the customer user in metadata and keeps actor_user_id nullable.
create or replace function public.submit_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_from public.offer_status;
  v_internal_actor uuid;
  v_contact_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(v_offer.transaction_id, array['accepted_buyer']::public.party_role[]);
  if private.can_manage_offer(p_offer_id, v_user_id) then
    v_internal_actor := v_user_id;
  elsif v_contact_id is null or v_contact_id is distinct from v_offer.buyer_contact_id then
    raise exception 'Not authorized to submit this offer' using errcode = '42501';
  end if;
  if v_offer.status not in ('draft', 'change_requested') then
    raise exception 'Only a draft or change-requested offer can be submitted' using errcode = '23514';
  end if;
  v_from := v_offer.status;
  update public.offers set status = 'submitted', submitted_at = now(), buyer_user_id = coalesce(buyer_user_id, v_user_id)
  where id = p_offer_id returning * into v_offer;
  insert into public.offer_status_history (organization_id, offer_id, from_status, to_status, changed_by, reason)
  values (v_offer.organization_id, p_offer_id, v_from, 'submitted', v_user_id, 'Offer submitted for agent review');
  insert into public.activity_events (organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata)
  values (v_offer.organization_id, v_offer.transaction_id, v_internal_actor, 'offer_submitted', 'buyer', 'Offer submitted', jsonb_build_object('offer_id', p_offer_id, 'customer_user_id', case when v_internal_actor is null then v_user_id else null end));
  return v_offer;
end;
$$;

create function public.record_customer_seller_offer_intent(p_offer_id uuid, p_intent public.seller_intent)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_offer public.offers%rowtype; v_contact_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(v_offer.transaction_id, array['seller', 'co_owner']::public.party_role[]);
  if v_contact_id is null or v_offer.sent_to_seller_at is null then raise exception 'Portal access denied' using errcode = '42501'; end if;
  if v_offer.status not in ('sent_to_seller', 'seller_intent_recorded') then raise exception 'Offer is not available for seller response' using errcode = '23514'; end if;
  insert into public.seller_offer_responses (organization_id, offer_id, seller_contact_id, intent, submitted_by)
  values (v_offer.organization_id, p_offer_id, v_contact_id, p_intent, auth.uid());
  update public.offers set status = 'seller_intent_recorded' where id = p_offer_id;
  insert into public.offer_status_history (
    organization_id, offer_id, from_status, to_status, changed_by, reason
  ) values (
    v_offer.organization_id, p_offer_id, v_offer.status,
    'seller_intent_recorded', auth.uid(), format('Seller workflow intent: %s', p_intent)
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_offer.organization_id, v_offer.transaction_id, null,
    'seller_offer_intent_recorded', 'internal', 'Seller workflow intent recorded',
    jsonb_build_object('offer_id', p_offer_id, 'customer_user_id', auth.uid(), 'intent', p_intent)
  );
  return public.seller_offer_summary(p_offer_id);
end;
$$;

revoke all on function public.seller_transaction_summary(uuid) from public, anon;
revoke all on function public.seller_offer_summary(uuid) from public, anon;
revoke all on function public.buyer_property_summary(uuid) from public, anon;
revoke all on function public.buyer_offer_status(uuid) from public, anon;
revoke all on function public.save_buyer_offer_draft(uuid, bigint, timestamptz, date, jsonb) from public, anon;
revoke all on function public.record_customer_seller_offer_intent(uuid, public.seller_intent) from public, anon;
grant execute on function public.seller_transaction_summary(uuid) to authenticated;
grant execute on function public.seller_offer_summary(uuid) to authenticated;
grant execute on function public.buyer_property_summary(uuid) to authenticated;
grant execute on function public.buyer_offer_status(uuid) to authenticated;
grant execute on function public.save_buyer_offer_draft(uuid, bigint, timestamptz, date, jsonb) to authenticated;
grant execute on function public.record_customer_seller_offer_intent(uuid, public.seller_intent) to authenticated;

-- Remove the anonymous, fixed-record Phase 3 bridge. All portal access now
-- requires an authenticated user and an active transaction-scoped grant.
revoke all on function public.demo_buyer_offer_summary() from anon, authenticated;
revoke all on function public.demo_save_buyer_offer_draft(bigint, timestamptz, date, jsonb) from anon, authenticated;
revoke all on function public.demo_submit_buyer_offer() from anon, authenticated;
revoke all on function public.demo_seller_offer_summary() from anon, authenticated;
revoke all on function public.demo_record_seller_offer_intent(public.seller_intent) from anon, authenticated;
drop function public.demo_buyer_offer_summary();
drop function public.demo_save_buyer_offer_draft(bigint, timestamptz, date, jsonb);
drop function public.demo_submit_buyer_offer();
drop function public.demo_seller_offer_summary();
drop function public.demo_record_seller_offer_intent(public.seller_intent);

comment on table public.portal_access_grants is 'Transaction-scoped customer portal authorization. Internal organization membership does not imply portal access.';
comment on function public.seller_transaction_summary(uuid) is 'Seller-safe transaction projection; requires an active seller or co-owner grant.';
comment on function public.buyer_offer_status(uuid) is 'Buyer-safe own-offer projection; excludes seller intent until deliberately communicated.';
