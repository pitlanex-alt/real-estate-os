-- Mó Phase 7B: append-only seller review of prepared listing content.

create type public.listing_seller_response_type as enum (
  'approved',
  'changes_requested'
);

create table public.seller_listing_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  seller_contact_id uuid not null,
  seller_user_id uuid not null references public.profiles(id),
  response_type public.listing_seller_response_type not null,
  feedback text check (feedback is null or length(feedback) <= 4000),
  submitted_at timestamptz not null default now(),
  constraint seller_listing_responses_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint seller_listing_responses_contact_org_fkey
    foreign key (seller_contact_id, organization_id)
    references public.contacts(id, organization_id)
);

create index seller_listing_responses_transaction_latest_idx
  on public.seller_listing_responses (transaction_id, submitted_at desc, id desc);

alter table public.seller_listing_responses enable row level security;

create policy seller_listing_responses_select_internal
on public.seller_listing_responses for select to authenticated
using (private.is_org_member(organization_id));

-- Customer writes go through record_seller_listing_response. There are deliberately
-- no direct INSERT/UPDATE/DELETE grants: a response is immutable once recorded.
revoke all on public.seller_listing_responses from anon, authenticated;
grant select on public.seller_listing_responses to authenticated;

create or replace function private.refresh_listing_readiness(p_transaction_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_property public.properties%rowtype;
  v_facts_complete boolean;
  v_photos_uploaded boolean;
  v_description_complete boolean;
  v_seller_approved boolean;
  v_state text;
begin
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found then return null; end if;

  select * into v_property
  from public.properties
  where id = v_transaction.property_id;

  v_facts_complete := nullif(trim(v_property.property_type), '') is not null
    and v_property.size_sqm is not null
    and v_property.room_count is not null
    and v_property.year_built is not null;
  v_photos_uploaded := exists (
    select 1 from public.property_images image
    where image.property_id = v_property.id
  );
  v_description_complete := nullif(trim(v_transaction.listing_title), '') is not null
    and nullif(trim(v_transaction.listing_description), '') is not null;
  v_seller_approved := coalesce((
    select response.response_type = 'approved'::public.listing_seller_response_type
    from public.seller_listing_responses response
    where response.transaction_id = p_transaction_id
    order by response.submitted_at desc, response.id desc
    limit 1
  ), false);

  if v_facts_complete
    and v_photos_uploaded
    and v_description_complete
    and v_seller_approved
    and v_transaction.listing_documents_ready then
    v_state := 'ready';
  elsif v_property.property_type is not null
    or v_transaction.asking_price_isk is not null
    or v_transaction.listing_title is not null
    or v_transaction.listing_description is not null
    or cardinality(v_transaction.listing_highlights) > 0
    or v_photos_uploaded
    or exists (
      select 1 from public.seller_listing_responses response
      where response.transaction_id = p_transaction_id
    )
    or v_transaction.listing_documents_ready then
    v_state := 'in_progress';
  else
    v_state := 'not_started';
  end if;

  update public.transactions
  set listing_seller_approved = v_seller_approved,
      listing_readiness = v_state
  where id = p_transaction_id;
  return v_state;
end;
$$;

revoke all on function private.refresh_listing_readiness(uuid) from public, anon, authenticated;

drop function public.update_listing_preparation(
  uuid,text,integer,text,bigint,text,text,text[],bigint,boolean,boolean
);

create function public.update_listing_preparation(
  p_transaction_id uuid,
  p_property_type text,
  p_floor integer,
  p_parking text,
  p_monthly_fees_isk bigint,
  p_listing_title text,
  p_listing_description text,
  p_listing_highlights text[],
  p_asking_price_isk bigint,
  p_required_documents_ready boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_highlight text;
  v_state text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_actor
      and membership.is_active
      and membership.role in ('admin', 'agent', 'coordinator')
  ) or not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_floor is not null and (p_floor < -10 or p_floor > 200) then
    raise exception 'Invalid floor' using errcode = '22023';
  end if;
  if p_monthly_fees_isk is not null and p_monthly_fees_isk < 0 then
    raise exception 'Invalid monthly fees' using errcode = '22023';
  end if;
  if p_asking_price_isk is not null and p_asking_price_isk < 0 then
    raise exception 'Invalid asking price' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_listing_highlights, '{}')) > 20 then
    raise exception 'Too many highlights' using errcode = '22023';
  end if;
  foreach v_highlight in array coalesce(p_listing_highlights, '{}') loop
    if length(v_highlight) > 160 then
      raise exception 'Highlight is too long' using errcode = '22023';
    end if;
  end loop;

  update public.properties set
    property_type = nullif(trim(p_property_type), ''),
    floor = p_floor,
    parking = nullif(trim(p_parking), ''),
    monthly_fees_isk = p_monthly_fees_isk
  where id = v_transaction.property_id;

  update public.transactions set
    asking_price_isk = p_asking_price_isk,
    listing_title = nullif(trim(p_listing_title), ''),
    listing_description = nullif(trim(p_listing_description), ''),
    listing_highlights = coalesce(p_listing_highlights, '{}'),
    listing_documents_ready = p_required_documents_ready
  where id = p_transaction_id;

  v_state := private.refresh_listing_readiness(p_transaction_id);
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'listing_preparation_updated', 'internal',
    'Listing preparation updated', jsonb_build_object('readiness', v_state)
  );
  return v_state;
end;
$$;

revoke all on function public.update_listing_preparation(
  uuid,text,integer,text,bigint,text,text,text[],bigint,boolean
) from public, anon;
grant execute on function public.update_listing_preparation(
  uuid,text,integer,text,bigint,text,text,text[],bigint,boolean
) to authenticated;

create function public.seller_listing_review(p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_contact_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_portal_access(
    p_transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  ) then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  v_contact_id := private.portal_contact_id(
    p_transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  );

  select jsonb_build_object(
    'transaction_id', transaction.id,
    'listing_title', transaction.listing_title,
    'listing_description', transaction.listing_description,
    'listing_highlights', to_jsonb(transaction.listing_highlights),
    'asking_price_isk', transaction.asking_price_isk,
    'listing_readiness', transaction.listing_readiness,
    'property', jsonb_build_object(
      'address', property.address_line,
      'postal_code', property.postal_code,
      'municipality', property.municipality,
      'property_type', property.property_type,
      'floor', property.floor,
      'parking', property.parking,
      'monthly_fees_isk', property.monthly_fees_isk,
      'size_sqm', property.size_sqm,
      'room_count', property.room_count,
      'bedroom_count', property.bedroom_count,
      'year_built', property.year_built
    ),
    'readiness', jsonb_build_object(
      'property_facts_complete', nullif(trim(property.property_type), '') is not null
        and property.size_sqm is not null
        and property.room_count is not null
        and property.year_built is not null,
      'photos_uploaded', exists (
        select 1 from public.property_images image where image.property_id = property.id
      ),
      'description_complete', nullif(trim(transaction.listing_title), '') is not null
        and nullif(trim(transaction.listing_description), '') is not null,
      'seller_approved', transaction.listing_seller_approved,
      'required_documents_ready', transaction.listing_documents_ready
    ),
    'latest_response', (
      select jsonb_build_object(
        'response_type', response.response_type,
        'feedback', response.feedback,
        'submitted_at', response.submitted_at
      )
      from public.seller_listing_responses response
      where response.transaction_id = transaction.id
        and response.seller_contact_id = v_contact_id
        and response.seller_user_id = auth.uid()
      order by response.submitted_at desc, response.id desc
      limit 1
    )
  ) into v_result
  from public.transactions transaction
  join public.properties property on property.id = transaction.property_id
  where transaction.id = p_transaction_id;

  return v_result;
end;
$$;

revoke all on function public.seller_listing_review(uuid) from public, anon;
grant execute on function public.seller_listing_review(uuid) to authenticated;

create function public.record_seller_listing_response(
  p_transaction_id uuid,
  p_response_type public.listing_seller_response_type,
  p_feedback text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_contact_id uuid;
  v_transaction public.transactions%rowtype;
  v_response_id uuid;
  v_feedback text := nullif(trim(p_feedback), '');
  v_state text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_portal_access(
    p_transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  ) then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  if v_feedback is not null and length(v_feedback) > 4000 then
    raise exception 'Feedback is too long' using errcode = '22023';
  end if;

  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  if nullif(trim(v_transaction.listing_title), '') is null
    or nullif(trim(v_transaction.listing_description), '') is null then
    raise exception 'Listing is not ready for seller review' using errcode = '22023';
  end if;

  v_contact_id := private.portal_contact_id(
    p_transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  );
  insert into public.seller_listing_responses (
    organization_id, transaction_id, seller_contact_id, seller_user_id,
    response_type, feedback
  ) values (
    v_transaction.organization_id, p_transaction_id, v_contact_id, v_actor,
    p_response_type, case when p_response_type = 'changes_requested' then v_feedback else null end
  ) returning id into v_response_id;

  v_state := private.refresh_listing_readiness(p_transaction_id);
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    case when p_response_type = 'approved'
      then 'seller_listing_approved'
      else 'seller_listing_changes_requested'
    end,
    'internal',
    case when p_response_type = 'approved'
      then 'Seller approved listing'
      else 'Seller requested listing changes'
    end,
    jsonb_build_object(
      'response_id', v_response_id,
      'response_type', p_response_type,
      'feedback', case when p_response_type = 'changes_requested' then v_feedback else null end,
      'readiness', v_state
    )
  );
  return v_response_id;
end;
$$;

revoke all on function public.record_seller_listing_response(
  uuid,public.listing_seller_response_type,text
) from public, anon;
grant execute on function public.record_seller_listing_response(
  uuid,public.listing_seller_response_type,text
) to authenticated;

comment on table public.seller_listing_responses is
  'Immutable seller listing approval/change-request history. Customer writes are accepted only through a guarded RPC.';
comment on column public.transactions.listing_seller_approved is
  'Derived cache of the latest seller listing response; internal users cannot set it directly.';

do $$
declare v_transaction record;
begin
  for v_transaction in select id from public.transactions loop
    perform private.refresh_listing_readiness(v_transaction.id);
  end loop;
end $$;
