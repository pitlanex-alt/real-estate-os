do $$
begin
  if not exists (select 1 from pg_type where typname = 'offer_status' and typnamespace = 'public'::regnamespace) then
    create type public.offer_status as enum (
      'draft', 'submitted', 'change_requested', 'agent_approved',
      'sent_to_seller', 'seller_intent_recorded', 'withdrawn', 'expired', 'superseded'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'seller_intent' and typnamespace = 'public'::regnamespace) then
    create type public.seller_intent as enum ('accept', 'reject', 'counter_offer');
  end if;
end
$$;

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  buyer_contact_id uuid not null,
  buyer_user_id uuid references public.profiles(id),
  amount_isk bigint not null check (amount_isk > 0),
  valid_until timestamptz not null,
  requested_handover_date date not null,
  status public.offer_status not null default 'draft',
  submitted_at timestamptz,
  agent_approved_at timestamptz,
  sent_to_seller_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint offers_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint offers_buyer_contact_id_fkey
    foreign key (buyer_contact_id) references public.contacts(id),
  constraint offers_buyer_contact_org_fkey
    foreign key (buyer_contact_id, organization_id)
    references public.contacts(id, organization_id),
  unique (id, organization_id)
);

create table public.offer_conditions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null,
  condition_type text not null check (length(trim(condition_type)) > 0),
  status text,
  details text,
  created_at timestamptz not null default now(),
  constraint offer_conditions_offer_id_fkey
    foreign key (offer_id) references public.offers(id) on delete cascade,
  constraint offer_conditions_offer_org_fkey
    foreign key (offer_id, organization_id)
    references public.offers(id, organization_id) on delete cascade,
  unique (offer_id, condition_type)
);

create table public.offer_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null,
  reviewed_by uuid not null references public.profiles(id),
  buyer_identified boolean not null default false,
  contact_confirmed boolean not null default false,
  financing_needs_confirmation boolean not null default false,
  validity_recorded boolean not null default false,
  handover_recorded boolean not null default false,
  internal_notes text not null default '',
  change_request text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint offer_reviews_offer_id_fkey
    foreign key (offer_id) references public.offers(id) on delete cascade,
  constraint offer_reviews_offer_org_fkey
    foreign key (offer_id, organization_id)
    references public.offers(id, organization_id) on delete cascade,
  constraint offer_reviews_reviewer_membership_fkey
    foreign key (organization_id, reviewed_by)
    references public.organization_memberships(organization_id, user_id),
  unique (offer_id)
);

create table public.offer_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null,
  from_status public.offer_status,
  to_status public.offer_status not null,
  changed_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  constraint offer_status_history_offer_id_fkey
    foreign key (offer_id) references public.offers(id) on delete cascade,
  constraint offer_status_history_offer_org_fkey
    foreign key (offer_id, organization_id)
    references public.offers(id, organization_id) on delete cascade
);

create table public.seller_offer_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null,
  seller_contact_id uuid not null,
  intent public.seller_intent not null,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  agent_acknowledged_at timestamptz,
  constraint seller_offer_responses_offer_id_fkey
    foreign key (offer_id) references public.offers(id) on delete cascade,
  constraint seller_offer_responses_offer_org_fkey
    foreign key (offer_id, organization_id)
    references public.offers(id, organization_id) on delete cascade,
  constraint seller_offer_responses_seller_contact_id_fkey
    foreign key (seller_contact_id) references public.contacts(id),
  constraint seller_offer_responses_seller_contact_org_fkey
    foreign key (seller_contact_id, organization_id)
    references public.contacts(id, organization_id)
);

create index offers_transaction_status_idx on public.offers (transaction_id, status);
create index offers_organization_status_idx on public.offers (organization_id, status);
create index offers_buyer_contact_idx on public.offers (buyer_contact_id);
create index offer_conditions_offer_idx on public.offer_conditions (offer_id);
create index offer_status_history_offer_created_idx on public.offer_status_history (offer_id, created_at);
create index seller_offer_responses_offer_created_idx on public.seller_offer_responses (offer_id, submitted_at);

create trigger offers_set_updated_at
before update on public.offers
for each row execute function private.set_updated_at();

create function private.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;

create trigger offer_status_history_append_only
before update or delete on public.offer_status_history
for each row execute function private.prevent_append_only_mutation();

create trigger seller_offer_responses_append_only
before update or delete on public.seller_offer_responses
for each row execute function private.prevent_append_only_mutation();

alter table public.offers enable row level security;
alter table public.offer_conditions enable row level security;
alter table public.offer_reviews enable row level security;
alter table public.offer_status_history enable row level security;
alter table public.seller_offer_responses enable row level security;

create policy offers_select_members on public.offers
for select to authenticated using (private.is_org_member(organization_id));
create policy offer_conditions_select_members on public.offer_conditions
for select to authenticated using (private.is_org_member(organization_id));
create policy offer_reviews_select_members on public.offer_reviews
for select to authenticated using (private.is_org_member(organization_id));
create policy offer_status_history_select_members on public.offer_status_history
for select to authenticated using (private.is_org_member(organization_id));
create policy seller_offer_responses_select_members on public.seller_offer_responses
for select to authenticated using (private.is_org_member(organization_id));

revoke all on public.offers, public.offer_conditions, public.offer_reviews,
  public.offer_status_history, public.seller_offer_responses from anon, authenticated;
grant select on public.offers, public.offer_conditions, public.offer_reviews,
  public.offer_status_history, public.seller_offer_responses to authenticated;

create function private.can_manage_offer(p_offer_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.offers offer
    where offer.id = p_offer_id
      and private.can_manage_transaction(offer.transaction_id, p_user_id)
  );
$$;

create function private.append_offer_transition(
  p_offer_id uuid,
  p_from_status public.offer_status,
  p_to_status public.offer_status,
  p_changed_by uuid,
  p_reason text,
  p_event_type text,
  p_visibility public.activity_visibility,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers%rowtype;
begin
  select * into strict v_offer from public.offers where id = p_offer_id;
  insert into public.offer_status_history (
    organization_id, offer_id, from_status, to_status, changed_by, reason
  ) values (
    v_offer.organization_id, p_offer_id, p_from_status, p_to_status,
    p_changed_by, nullif(trim(p_reason), '')
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_offer.organization_id, v_offer.transaction_id, p_changed_by,
    p_event_type, p_visibility, p_summary,
    jsonb_build_object('offer_id', p_offer_id, 'from_status', p_from_status, 'to_status', p_to_status)
  );
end;
$$;

create function private.replace_offer_conditions(p_offer_id uuid, p_conditions jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_condition jsonb;
begin
  if p_conditions is null or jsonb_typeof(p_conditions) <> 'array' then
    raise exception 'Conditions must be a JSON array' using errcode = '22023';
  end if;
  select organization_id into strict v_organization_id from public.offers where id = p_offer_id;
  delete from public.offer_conditions where offer_id = p_offer_id;
  for v_condition in select value from jsonb_array_elements(p_conditions)
  loop
    if nullif(trim(v_condition ->> 'type'), '') is null then
      raise exception 'Every condition requires a type' using errcode = '22023';
    end if;
    insert into public.offer_conditions (organization_id, offer_id, condition_type, status, details)
    values (
      v_organization_id,
      p_offer_id,
      trim(v_condition ->> 'type'),
      nullif(trim(v_condition ->> 'status'), ''),
      nullif(trim(v_condition ->> 'details'), '')
    );
  end loop;
end;
$$;

revoke all on function private.can_manage_offer(uuid, uuid) from public, anon, authenticated;
revoke all on function private.append_offer_transition(uuid, public.offer_status, public.offer_status, uuid, text, text, public.activity_visibility, text) from public, anon, authenticated;
revoke all on function private.replace_offer_conditions(uuid, jsonb) from public, anon, authenticated;

create function public.create_offer_draft(
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
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select organization_id into v_organization_id from public.transactions where id = p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
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
    v_offer.id, null, 'draft', v_user_id, 'Offer draft created',
    'offer_draft_created', 'internal', 'Offer draft created'
  );
  return v_offer;
end;
$$;

create function public.submit_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_from public.offer_status;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if not (private.can_manage_offer(p_offer_id, v_user_id) or v_offer.buyer_user_id = v_user_id) then
    raise exception 'Not authorized to submit this offer' using errcode = '42501';
  end if;
  if v_offer.status not in ('draft', 'change_requested') then
    raise exception 'Only a draft or change-requested offer can be submitted' using errcode = '23514';
  end if;
  v_from := v_offer.status;
  update public.offers set status = 'submitted', submitted_at = now()
  where id = p_offer_id returning * into v_offer;
  perform private.append_offer_transition(
    p_offer_id, v_from, 'submitted', v_user_id, 'Offer submitted for agent review',
    'offer_submitted', 'buyer', 'Offer submitted'
  );
  return v_offer;
end;
$$;

create function public.request_offer_change(p_offer_id uuid, p_reason text)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if not private.can_manage_offer(p_offer_id, v_user_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_offer.status <> 'submitted' then raise exception 'Offer must be submitted' using errcode = '23514'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Change reason is required' using errcode = '22023'; end if;
  update public.offers set status = 'change_requested' where id = p_offer_id returning * into v_offer;
  insert into public.offer_reviews (
    organization_id, offer_id, reviewed_by, change_request, reviewed_at
  ) values (
    v_offer.organization_id, p_offer_id, v_user_id, trim(p_reason), now()
  ) on conflict (offer_id) do update set
    reviewed_by = excluded.reviewed_by,
    change_request = excluded.change_request,
    reviewed_at = excluded.reviewed_at;
  perform private.append_offer_transition(
    p_offer_id, 'submitted', 'change_requested', v_user_id, p_reason,
    'offer_change_requested', 'buyer', 'Agent requested changes to offer'
  );
  return v_offer;
end;
$$;

create function public.approve_offer_for_seller(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if not private.can_manage_offer(p_offer_id, v_user_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_offer.status <> 'submitted' then raise exception 'Offer must be submitted' using errcode = '23514'; end if;
  update public.offers set status = 'agent_approved', agent_approved_at = now()
  where id = p_offer_id returning * into v_offer;
  insert into public.offer_reviews (
    organization_id, offer_id, reviewed_by, buyer_identified,
    contact_confirmed, financing_needs_confirmation, validity_recorded,
    handover_recorded, reviewed_at
  ) values (
    v_offer.organization_id, p_offer_id, v_user_id, true, true, true, true, true, now()
  ) on conflict (offer_id) do update set
    reviewed_by = excluded.reviewed_by,
    buyer_identified = excluded.buyer_identified,
    contact_confirmed = excluded.contact_confirmed,
    financing_needs_confirmation = excluded.financing_needs_confirmation,
    validity_recorded = excluded.validity_recorded,
    handover_recorded = excluded.handover_recorded,
    change_request = null,
    reviewed_at = excluded.reviewed_at;
  perform private.append_offer_transition(
    p_offer_id, 'submitted', 'agent_approved', v_user_id, 'Approved for seller review',
    'offer_agent_approved', 'buyer', 'Agent reviewed offer'
  );
  return v_offer;
end;
$$;

create function public.send_offer_to_seller(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if not private.can_manage_offer(p_offer_id, v_user_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_offer.status <> 'agent_approved' then raise exception 'Offer must be agent approved' using errcode = '23514'; end if;
  update public.offers set status = 'sent_to_seller', sent_to_seller_at = now()
  where id = p_offer_id returning * into v_offer;
  perform private.append_offer_transition(
    p_offer_id, 'agent_approved', 'sent_to_seller', v_user_id, 'Sent to seller',
    'offer_sent_to_seller', 'seller_and_buyer', 'Offer sent to seller'
  );
  return v_offer;
end;
$$;

create function public.record_seller_offer_intent(p_offer_id uuid, p_seller_contact_id uuid, p_intent public.seller_intent)
returns public.seller_offer_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_response public.seller_offer_responses%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if not private.can_manage_offer(p_offer_id, v_user_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_offer.status not in ('sent_to_seller', 'seller_intent_recorded') then
    raise exception 'Offer has not been sent to seller' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.transaction_parties party
    where party.transaction_id = v_offer.transaction_id
      and party.contact_id = p_seller_contact_id
      and party.role in ('seller', 'co_owner')
  ) then raise exception 'Contact is not a seller party' using errcode = '42501'; end if;
  insert into public.seller_offer_responses (
    organization_id, offer_id, seller_contact_id, intent, submitted_by
  ) values (
    v_offer.organization_id, p_offer_id, p_seller_contact_id, p_intent, v_user_id
  ) returning * into v_response;
  update public.offers set status = 'seller_intent_recorded' where id = p_offer_id;
  perform private.append_offer_transition(
    p_offer_id, v_offer.status, 'seller_intent_recorded', v_user_id,
    format('Seller workflow intent: %s', p_intent), 'seller_offer_intent_recorded',
    'internal', 'Seller workflow intent recorded'
  );
  return v_response;
end;
$$;

revoke all on function public.create_offer_draft(uuid, uuid, bigint, timestamptz, date, jsonb) from public, anon;
grant execute on function public.create_offer_draft(uuid, uuid, bigint, timestamptz, date, jsonb) to authenticated;
revoke all on function public.submit_offer(uuid) from public, anon;
grant execute on function public.submit_offer(uuid) to authenticated;
revoke all on function public.request_offer_change(uuid, text) from public, anon;
grant execute on function public.request_offer_change(uuid, text) to authenticated;
revoke all on function public.approve_offer_for_seller(uuid) from public, anon;
grant execute on function public.approve_offer_for_seller(uuid) to authenticated;
revoke all on function public.send_offer_to_seller(uuid) from public, anon;
grant execute on function public.send_offer_to_seller(uuid) to authenticated;
revoke all on function public.record_seller_offer_intent(uuid, uuid, public.seller_intent) from public, anon;
grant execute on function public.record_seller_offer_intent(uuid, uuid, public.seller_intent) to authenticated;

-- Development-only portal bridge for the fixed fictional offer. These functions
-- expose no base-table access and must be replaced by transaction-scoped portal
-- grants when customer authentication is implemented.
create function public.demo_buyer_offer_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', offer.id,
    -- A recorded seller intent is not a buyer-visible decision. Until the
    -- agent deliberately communicates an outcome, the buyer sees only that
    -- the offer remains with the seller.
    'status', case when offer.status = 'seller_intent_recorded' then 'sent_to_seller' else offer.status::text end,
    'amount_isk', offer.amount_isk,
    'valid_until', offer.valid_until,
    'requested_handover_date', offer.requested_handover_date,
    'submitted_at', offer.submitted_at,
    'buyer_name', buyer.full_name,
    'buyer_phone', buyer.phone,
    'buyer_email', buyer.email,
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object('type', condition.condition_type, 'status', condition.status, 'details', condition.details) order by condition.created_at)
      from public.offer_conditions condition where condition.offer_id = offer.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', history.to_status, 'created_at', history.created_at) order by history.created_at)
      from public.offer_status_history history
      where history.offer_id = offer.id
        and history.to_status <> 'seller_intent_recorded'
    ), '[]'::jsonb)
  )
  from public.offers offer
  join public.contacts buyer on buyer.id = offer.buyer_contact_id
  where offer.id = '90000000-0000-4000-8000-000000001042';
$$;

create function public.demo_save_buyer_offer_draft(
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
  v_offer_id constant uuid := '90000000-0000-4000-8000-000000001042';
  v_offer public.offers%rowtype;
begin
  if p_amount_isk <= 0 then raise exception 'Offer amount must be positive' using errcode = '22023'; end if;
  select * into v_offer from public.offers where id = v_offer_id for update;
  if found then
    if v_offer.status not in ('draft', 'change_requested') then
      raise exception 'Submitted demo offer is not editable' using errcode = '23514';
    end if;
    update public.offers set
      amount_isk = p_amount_isk,
      valid_until = p_valid_until,
      requested_handover_date = p_requested_handover_date
    where id = v_offer_id returning * into v_offer;
    perform private.replace_offer_conditions(v_offer_id, p_conditions);
    insert into public.activity_events (
      organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata
    ) values (
      v_offer.organization_id, v_offer.transaction_id, null, 'offer_draft_updated',
      'buyer', 'Buyer updated offer draft', jsonb_build_object('offer_id', v_offer_id)
    );
  else
    insert into public.offers (
      id, organization_id, transaction_id, buyer_contact_id, amount_isk,
      valid_until, requested_handover_date, status
    ) values (
      v_offer_id,
      '10000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001',
      p_amount_isk, p_valid_until, p_requested_handover_date, 'draft'
    ) returning * into v_offer;
    perform private.replace_offer_conditions(v_offer_id, p_conditions);
    perform private.append_offer_transition(
      v_offer_id, null, 'draft', null, 'Demo buyer draft created',
      'offer_draft_created', 'buyer', 'Buyer created offer draft'
    );
  end if;
  return public.demo_buyer_offer_summary();
end;
$$;

create function public.demo_submit_buyer_offer()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_id constant uuid := '90000000-0000-4000-8000-000000001042';
  v_offer public.offers%rowtype;
begin
  select * into v_offer from public.offers where id = v_offer_id for update;
  if not found then raise exception 'Demo offer draft not found' using errcode = 'P0002'; end if;
  if v_offer.status not in ('draft', 'change_requested') then
    raise exception 'Only a draft or change-requested offer can be submitted' using errcode = '23514';
  end if;
  update public.offers set status = 'submitted', submitted_at = now()
  where id = v_offer_id;
  perform private.append_offer_transition(
    v_offer_id, v_offer.status, 'submitted', null, 'Demo buyer submission',
    'offer_submitted', 'buyer', 'Offer submitted'
  );
  return public.demo_buyer_offer_summary();
end;
$$;

create function public.demo_seller_offer_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', offer.id,
    'status', offer.status,
    'amount_isk', offer.amount_isk,
    'asking_price_isk', transaction.asking_price_isk,
    'valid_until', offer.valid_until,
    'requested_handover_date', offer.requested_handover_date,
    'property', property.address_line,
    'location', property.postal_code || ' ' || property.municipality,
    'agent', agent.display_name,
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object('type', condition.condition_type, 'status', condition.status, 'details', condition.details) order by condition.created_at)
      from public.offer_conditions condition where condition.offer_id = offer.id
    ), '[]'::jsonb),
    'latest_intent', (
      select response.intent from public.seller_offer_responses response
      where response.offer_id = offer.id order by response.submitted_at desc, response.id desc limit 1
    )
  )
  from public.offers offer
  join public.transactions transaction on transaction.id = offer.transaction_id
  join public.properties property on property.id = transaction.property_id
  join public.profiles agent on agent.id = transaction.assigned_agent_id
  where offer.id = '90000000-0000-4000-8000-000000001042'
    and offer.status in ('sent_to_seller', 'seller_intent_recorded');
$$;

create function public.demo_record_seller_offer_intent(p_intent public.seller_intent)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_id constant uuid := '90000000-0000-4000-8000-000000001042';
  v_offer public.offers%rowtype;
begin
  select * into v_offer from public.offers where id = v_offer_id for update;
  if not found or v_offer.status not in ('sent_to_seller', 'seller_intent_recorded') then
    raise exception 'Demo offer is not available to seller' using errcode = '42501';
  end if;
  insert into public.seller_offer_responses (
    organization_id, offer_id, seller_contact_id, intent, submitted_by
  ) values (
    v_offer.organization_id, v_offer_id, '30000000-0000-4000-8000-000000000001', p_intent, null
  );
  update public.offers set status = 'seller_intent_recorded' where id = v_offer_id;
  perform private.append_offer_transition(
    v_offer_id, v_offer.status, 'seller_intent_recorded', null,
    format('Demo seller workflow intent: %s', p_intent),
    'seller_offer_intent_recorded', 'internal', 'Seller workflow intent recorded'
  );
  return public.demo_seller_offer_summary();
end;
$$;

revoke all on function public.demo_buyer_offer_summary() from public;
revoke all on function public.demo_save_buyer_offer_draft(bigint, timestamptz, date, jsonb) from public;
revoke all on function public.demo_submit_buyer_offer() from public;
revoke all on function public.demo_seller_offer_summary() from public;
revoke all on function public.demo_record_seller_offer_intent(public.seller_intent) from public;
grant execute on function public.demo_buyer_offer_summary() to anon, authenticated;
grant execute on function public.demo_save_buyer_offer_draft(bigint, timestamptz, date, jsonb) to anon, authenticated;
grant execute on function public.demo_submit_buyer_offer() to anon, authenticated;
grant execute on function public.demo_seller_offer_summary() to anon, authenticated;
grant execute on function public.demo_record_seller_offer_intent(public.seller_intent) to anon, authenticated;

comment on function public.demo_buyer_offer_summary() is 'Development-only safe projection for fictional offer 1042.';
comment on function public.demo_save_buyer_offer_draft(bigint, timestamptz, date, jsonb) is 'Development-only mutation limited to fictional offer 1042.';
comment on function public.demo_submit_buyer_offer() is 'Development-only mutation limited to fictional offer 1042.';
comment on function public.demo_seller_offer_summary() is 'Development-only seller-safe projection for fictional offer 1042.';
comment on function public.demo_record_seller_offer_intent(public.seller_intent) is 'Development-only append-only intent mutation for fictional offer 1042.';
comment on column public.offer_reviews.internal_notes is 'Internal CRM data. Never expose through customer-safe projections.';
