-- F-03: make offer validity authoritative at the database boundary.
-- Expiry remains derived for open offers so correctness does not depend on a cron job.

create or replace function private.offer_status_requires_validity(
  p_status public.offer_status
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in (
    'draft',
    'submitted',
    'change_requested',
    'agent_approved',
    'sent_to_seller',
    'seller_intent_recorded'
  );
$$;

create or replace function private.effective_offer_status(
  p_status public.offer_status,
  p_valid_until timestamptz
)
returns public.offer_status
language sql
volatile
set search_path = ''
as $$
  select case
    when private.offer_status_requires_validity(p_status)
      and p_valid_until <= clock_timestamp()
      then 'expired'::public.offer_status
    else p_status
  end;
$$;

create or replace function private.enforce_offer_validity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if private.offer_status_requires_validity(new.status)
      and new.valid_until <= clock_timestamp()
    then
      raise exception 'Offer validity has expired' using errcode = '23514';
    end if;
    return new;
  end if;

  -- An already-expired open offer is immutable except for terminal housekeeping.
  -- This prevents extending an expired draft and then progressing it from a stale tab.
  if private.offer_status_requires_validity(old.status)
    and old.valid_until <= clock_timestamp()
  then
    if new.status is distinct from old.status
      and new.status in ('expired', 'withdrawn', 'superseded')
    then
      return new;
    end if;
    raise exception 'Offer validity has expired' using errcode = '23514';
  end if;

  -- Also reject a transition/update that makes a still-open offer immediately invalid.
  if private.offer_status_requires_validity(new.status)
    and new.valid_until <= clock_timestamp()
  then
    raise exception 'Offer validity has expired' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists offers_enforce_validity on public.offers;
create trigger offers_enforce_validity
before insert or update on public.offers
for each row execute function private.enforce_offer_validity();

create or replace function private.enforce_seller_response_offer_validity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.offer_status;
  v_valid_until timestamptz;
begin
  -- The lock and real wall-clock check are in the same transaction as the append.
  select offer.status, offer.valid_until
  into v_status, v_valid_until
  from public.offers offer
  where offer.id = new.offer_id
  for update;

  if not found then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if private.offer_status_requires_validity(v_status)
    and v_valid_until <= clock_timestamp()
  then
    raise exception 'Offer validity has expired' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists seller_offer_responses_enforce_offer_validity
  on public.seller_offer_responses;
create trigger seller_offer_responses_enforce_offer_validity
before insert on public.seller_offer_responses
for each row execute function private.enforce_seller_response_offer_validity();

revoke all on function private.offer_status_requires_validity(public.offer_status)
  from public, anon, authenticated;
revoke all on function private.effective_offer_status(public.offer_status,timestamptz)
  from public, anon, authenticated;
revoke all on function private.enforce_offer_validity()
  from public, anon, authenticated;
revoke all on function private.enforce_seller_response_offer_validity()
  from public, anon, authenticated;

-- Customer-safe projections expose deterministic effective expiry while preserving
-- accepted/rejected/withdrawn/superseded historical outcomes.
create or replace function public.seller_offer_summary(p_offer_id uuid)
returns jsonb
language plpgsql
volatile
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
    'id', o.id,
    'status', private.effective_offer_status(o.status, o.valid_until),
    'amount_isk', o.amount_isk,
    'asking_price_isk', t.asking_price_isk,
    'valid_until', o.valid_until,
    'requested_handover_date', o.requested_handover_date,
    'property', p.address_line,
    'location', p.postal_code || ' ' || p.municipality,
    'agent', agent.display_name,
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', c.condition_type,
        'status', c.status,
        'details', c.details
      ) order by c.created_at)
      from public.offer_conditions c
      where c.offer_id = o.id
    ), '[]'::jsonb),
    'latest_intent', (
      select r.intent
      from public.seller_offer_responses r
      where r.offer_id = o.id
        and r.seller_contact_id = private.portal_contact_id(
          o.transaction_id,
          array['seller', 'co_owner']::public.party_role[]
        )
      order by r.submitted_at desc, r.id desc
      limit 1
    )
  ) into v_result
  from public.offers o
  join public.transactions t on t.id = o.transaction_id
  join public.properties p on p.id = t.property_id
  join public.profiles agent on agent.id = t.assigned_agent_id
  where o.id = p_offer_id;
  return v_result;
end;
$$;

create or replace function public.buyer_offer_status(p_offer_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_offer public.offers%rowtype; v_contact_id uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(
    v_offer.transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if v_contact_id is null or v_contact_id is distinct from v_offer.buyer_contact_id then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', o.id,
    'status', case
      when private.effective_offer_status(o.status, o.valid_until) = 'expired'
        then 'expired'
      when o.status = 'seller_intent_recorded' then 'sent_to_seller'
      else o.status::text
    end,
    'amount_isk', o.amount_isk,
    'valid_until', o.valid_until,
    'requested_handover_date', o.requested_handover_date,
    'submitted_at', o.submitted_at,
    'buyer_name', contact.full_name,
    'buyer_phone', contact.phone,
    'buyer_email', contact.email,
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', c.condition_type,
        'status', c.status,
        'details', c.details
      ) order by c.created_at)
      from public.offer_conditions c
      where c.offer_id = o.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', h.to_status,
        'created_at', h.created_at
      ) order by h.created_at)
      from public.offer_status_history h
      where h.offer_id = o.id
        and h.to_status <> 'seller_intent_recorded'
    ), '[]'::jsonb)
  ) into v_result
  from public.offers o
  join public.contacts contact on contact.id = o.buyer_contact_id
  where o.id = p_offer_id;
  return v_result;
end;
$$;

create or replace function public.customer_transaction_offers(p_transaction_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_seller boolean;
  v_buyer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  v_seller := private.has_portal_access(
    p_transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  );
  v_buyer := private.has_portal_access(
    p_transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if not v_seller and not v_buyer then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', offer.id,
      'status', private.effective_offer_status(offer.status, offer.valid_until),
      'amount_isk', offer.amount_isk,
      'valid_until', offer.valid_until
    ) order by offer.created_at desc)
    from public.offers offer
    where offer.transaction_id = p_transaction_id
      and (
        (v_seller and offer.status in (
          'sent_to_seller', 'seller_intent_recorded',
          'accepted', 'rejected', 'superseded'
        ))
        or (v_buyer and offer.buyer_user_id = auth.uid())
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.seller_offer_summary(uuid) from public, anon;
grant execute on function public.seller_offer_summary(uuid) to authenticated;
revoke all on function public.buyer_offer_status(uuid) from public, anon;
grant execute on function public.buyer_offer_status(uuid) to authenticated;
revoke all on function public.customer_transaction_offers(uuid) from public, anon;
grant execute on function public.customer_transaction_offers(uuid) to authenticated;

comment on function private.effective_offer_status(public.offer_status,timestamptz) is
  'Derives expired for open offers only; terminal historical outcomes remain authoritative.';
comment on function private.enforce_offer_validity() is
  'Rejects stale offer mutations at the table boundary using wall-clock time.';
