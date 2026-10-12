-- Kelvo: consistent active/archive projections and completed-transaction write guards.

drop function if exists public.customer_portal_destinations();
create function public.customer_portal_destinations()
returns table (
  transaction_id uuid,
  role public.party_role,
  property_slug text,
  address text,
  postal_code text,
  municipality text,
  transaction_stage public.transaction_stage
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
    property.slug,
    property.address_line,
    property.postal_code,
    property.municipality,
    transaction.stage
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
  order by
    case when transaction.stage in ('completed', 'cancelled') then 1 else 0 end,
    grant_row.activated_at desc,
    grant_row.created_at desc,
    grant_row.id;
end;
$$;

revoke all on function public.customer_portal_destinations() from public, anon;
grant execute on function public.customer_portal_destinations() to authenticated;

comment on function public.customer_portal_destinations() is
  'Returns the authenticated customer active portal grants with safe property data and transaction stage for active/history routing.';

create or replace function public.create_viewing(
  p_transaction_id uuid,
  p_viewing_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.viewings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_stage public.transaction_stage;
  v_viewing public.viewings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select transaction.organization_id, transaction.stage
  into v_organization_id, v_stage
  from public.transactions transaction
  where transaction.id = p_transaction_id;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_stage in ('completed', 'cancelled') then
    raise exception 'Completed transactions cannot receive new viewings' using errcode = '23514';
  end if;
  if not private.can_manage_transaction(p_transaction_id, v_user_id) then
    raise exception 'Not authorized to manage viewings for this transaction' using errcode = '42501';
  end if;
  if nullif(trim(p_viewing_type), '') is null or p_ends_at <= p_starts_at then
    raise exception 'Viewing type and a valid time range are required' using errcode = '22023';
  end if;

  insert into public.viewings (
    organization_id, transaction_id, viewing_type, starts_at, ends_at,
    status, created_by
  ) values (
    v_organization_id, p_transaction_id, trim(p_viewing_type), p_starts_at,
    p_ends_at, 'scheduled', v_user_id
  ) returning * into v_viewing;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_organization_id, p_transaction_id, v_user_id,
    'viewing_created', 'internal', 'Skoðun stofnuð',
    jsonb_build_object('viewing_id', v_viewing.id, 'starts_at', p_starts_at)
  );

  return v_viewing;
end;
$$;

create or replace function public.create_offer_draft(
  p_transaction_id uuid,
  p_buyer_contact_id uuid,
  p_amount_isk bigint,
  p_valid_until timestamptz,
  p_requested_handover_date date,
  p_conditions jsonb
)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_stage public.transaction_stage;
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select organization_id, stage into v_organization_id, v_stage
  from public.transactions where id = p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  if v_stage in ('completed', 'cancelled') then
    raise exception 'Completed transactions cannot receive new offers' using errcode = '23514';
  end if;
  if not private.can_manage_transaction(p_transaction_id, v_user_id) then
    raise exception 'Not authorized to create an offer for this transaction' using errcode = '42501';
  end if;
  if not exists (select 1 from public.contacts where id = p_buyer_contact_id and organization_id = v_organization_id) then
    raise exception 'Buyer contact does not belong to the transaction organization' using errcode = '23503';
  end if;
  if p_amount_isk <= 0 then raise exception 'Offer amount must be positive' using errcode = '22023'; end if;

  insert into public.offers (
    organization_id, transaction_id, buyer_contact_id, amount_isk,
    valid_until, requested_handover_date, status, created_by
  ) values (
    v_organization_id, p_transaction_id, p_buyer_contact_id, p_amount_isk,
    p_valid_until, p_requested_handover_date, 'draft', v_user_id
  ) returning * into v_offer;
  perform private.replace_offer_conditions(v_offer.id, p_conditions);
  perform private.append_offer_transition(
    v_offer.id, null, 'draft', v_user_id, 'Drög að tilboði stofnuð',
    'offer_draft_created', 'internal', 'Drög að tilboði stofnuð'
  );
  return v_offer;
end;
$$;

create or replace function public.create_customer_offer_draft(
  p_transaction_id uuid,
  p_amount_isk bigint,
  p_valid_until timestamptz,
  p_requested_handover_date date,
  p_conditions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_contact_id uuid;
  v_org_id uuid;
  v_stage public.transaction_stage;
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  v_contact_id := private.portal_contact_id(
    p_transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if v_contact_id is null then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  select organization_id, stage into v_org_id, v_stage
  from public.transactions
  where id = p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  if v_stage in ('completed', 'cancelled') then
    raise exception 'Completed transactions cannot receive new offers' using errcode = '23514';
  end if;
  if p_amount_isk <= 0 or p_valid_until <= now() then
    raise exception 'Invalid offer values' using errcode = '22023';
  end if;

  insert into public.offers (
    organization_id, transaction_id, buyer_contact_id, buyer_user_id,
    amount_isk, valid_until, requested_handover_date, status, created_by
  ) values (
    v_org_id, p_transaction_id, v_contact_id, v_user_id,
    p_amount_isk, p_valid_until, p_requested_handover_date, 'draft', null
  ) returning * into v_offer;
  perform private.replace_offer_conditions(v_offer.id, p_conditions);
  insert into public.offer_status_history (
    organization_id, offer_id, from_status, to_status, changed_by, reason
  ) values (
    v_org_id, v_offer.id, null, 'draft', v_user_id, 'Drög að tilboði stofnuð'
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_org_id, p_transaction_id, null, 'offer_draft_created', 'buyer',
    'Drög að tilboði stofnuð',
    jsonb_build_object('offer_id', v_offer.id, 'buyer_user_id', v_user_id)
  );
  return public.buyer_offer_status(v_offer.id);
end;
$$;

revoke all on function public.create_viewing(uuid,text,timestamptz,timestamptz) from public, anon;
revoke all on function public.create_offer_draft(uuid,uuid,bigint,timestamptz,date,jsonb) from public, anon;
revoke all on function public.create_customer_offer_draft(uuid,bigint,timestamptz,date,jsonb) from public, anon;
grant execute on function public.create_viewing(uuid,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.create_offer_draft(uuid,uuid,bigint,timestamptz,date,jsonb) to authenticated;
grant execute on function public.create_customer_offer_draft(uuid,bigint,timestamptz,date,jsonb) to authenticated;
