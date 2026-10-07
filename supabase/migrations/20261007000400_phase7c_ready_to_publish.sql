-- Mó Phase 7C: internal ready-to-publish gate. This does not publish externally.

alter table public.transactions
  add column listing_revision integer not null default 0 check (listing_revision >= 0),
  add column ready_for_publish_at timestamptz,
  add column ready_for_publish_by uuid references public.profiles(id),
  add constraint transactions_ready_for_publish_pair_check check (
    (ready_for_publish_at is null and ready_for_publish_by is null)
    or (ready_for_publish_at is not null and ready_for_publish_by is not null)
  ),
  add constraint transactions_ready_for_publish_member_fkey
    foreign key (organization_id, ready_for_publish_by)
    references public.organization_memberships(organization_id, user_id);

alter table public.seller_listing_responses
  add column listing_revision integer not null default 0 check (listing_revision >= 0);

create function private.invalidate_listing_publish_readiness(
  p_transaction_id uuid,
  p_actor uuid default auth.uid(),
  p_increment_revision boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_event_actor uuid;
begin
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found then return; end if;

  if p_actor is not null and exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = p_actor
      and membership.is_active
  ) then
    v_event_actor := p_actor;
  end if;

  update public.transactions
  set listing_revision = listing_revision + case when p_increment_revision then 1 else 0 end,
      listing_seller_approved = false,
      ready_for_publish_at = null,
      ready_for_publish_by = null
  where id = p_transaction_id;

  if v_transaction.ready_for_publish_at is not null then
    insert into public.activity_events (
      organization_id, transaction_id, actor_user_id, event_type,
      visibility, summary, metadata
    ) values (
      v_transaction.organization_id, p_transaction_id, v_event_actor,
      'listing_publish_readiness_invalidated', 'internal',
      'Listing publish readiness invalidated',
      jsonb_build_object(
        'previous_ready_for_publish_at', v_transaction.ready_for_publish_at,
        'previous_ready_for_publish_by', v_transaction.ready_for_publish_by,
        'triggered_by_user_id', p_actor
      )
    );
  end if;
end;
$$;

revoke all on function private.invalidate_listing_publish_readiness(uuid,uuid,boolean)
  from public, anon, authenticated;

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
      and response.listing_revision = v_transaction.listing_revision
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

create function private.listing_publish_requirements_met(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(trim(property.property_type), '') is not null
    and property.size_sqm is not null
    and property.room_count is not null
    and property.year_built is not null
    and nullif(trim(transaction.listing_title), '') is not null
    and nullif(trim(transaction.listing_description), '') is not null
    and exists (
      select 1 from public.property_images image
      where image.property_id = property.id
    )
    and transaction.listing_documents_ready
    and exists (
      select 1
      from public.seller_listing_responses response
      where response.transaction_id = transaction.id
        and response.listing_revision = transaction.listing_revision
        and response.response_type = 'approved'
        and not exists (
          select 1
          from public.seller_listing_responses newer
          where newer.transaction_id = response.transaction_id
            and newer.listing_revision = response.listing_revision
            and (newer.submitted_at, newer.id) > (response.submitted_at, response.id)
        )
    ), false
  )
  from public.transactions transaction
  join public.properties property on property.id = transaction.property_id
  where transaction.id = p_transaction_id;
$$;

revoke all on function private.listing_publish_requirements_met(uuid)
  from public, anon, authenticated;

create or replace function private.refresh_property_listing_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property_id uuid;
  v_transaction record;
  v_relevant_change boolean := true;
begin
  if tg_op = 'DELETE' then
    v_property_id := old.property_id;
  else
    v_property_id := new.property_id;
  end if;

  if tg_op = 'UPDATE' then
    v_relevant_change := old.storage_path is distinct from new.storage_path
      or old.file_name is distinct from new.file_name
      or old.sort_order is distinct from new.sort_order
      or old.is_cover is distinct from new.is_cover;
  end if;
  if not v_relevant_change then return null; end if;

  for v_transaction in
    select id from public.transactions
    where property_id = v_property_id
      and stage not in ('completed', 'cancelled')
  loop
    perform private.invalidate_listing_publish_readiness(v_transaction.id, auth.uid(), true);
    perform private.refresh_listing_readiness(v_transaction.id);
  end loop;
  return null;
end;
$$;

drop trigger property_images_refresh_listing_readiness on public.property_images;
create trigger property_images_refresh_listing_readiness
after insert or update or delete on public.property_images
for each row execute function private.refresh_property_listing_readiness();

create or replace function public.update_listing_preparation(
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
  v_property public.properties%rowtype;
  v_highlight text;
  v_state text;
  v_changed boolean;
  v_property_type text := nullif(trim(p_property_type), '');
  v_parking text := nullif(trim(p_parking), '');
  v_listing_title text := nullif(trim(p_listing_title), '');
  v_listing_description text := nullif(trim(p_listing_description), '');
  v_listing_highlights text[] := coalesce(p_listing_highlights, '{}'::text[]);
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
  if cardinality(v_listing_highlights) > 20 then
    raise exception 'Too many highlights' using errcode = '22023';
  end if;
  foreach v_highlight in array v_listing_highlights loop
    if length(v_highlight) > 160 then
      raise exception 'Highlight is too long' using errcode = '22023';
    end if;
  end loop;

  select * into v_property
  from public.properties
  where id = v_transaction.property_id
  for update;

  v_changed := v_property.property_type is distinct from v_property_type
    or v_property.floor is distinct from p_floor
    or v_property.parking is distinct from v_parking
    or v_property.monthly_fees_isk is distinct from p_monthly_fees_isk
    or v_transaction.asking_price_isk is distinct from p_asking_price_isk
    or v_transaction.listing_title is distinct from v_listing_title
    or v_transaction.listing_description is distinct from v_listing_description
    or v_transaction.listing_highlights is distinct from v_listing_highlights
    or v_transaction.listing_documents_ready is distinct from p_required_documents_ready;

  update public.properties set
    property_type = v_property_type,
    floor = p_floor,
    parking = v_parking,
    monthly_fees_isk = p_monthly_fees_isk
  where id = v_transaction.property_id;

  update public.transactions set
    asking_price_isk = p_asking_price_isk,
    listing_title = v_listing_title,
    listing_description = v_listing_description,
    listing_highlights = v_listing_highlights,
    listing_documents_ready = p_required_documents_ready
  where id = p_transaction_id;

  if v_changed then
    perform private.invalidate_listing_publish_readiness(p_transaction_id, v_actor, true);
  end if;
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

create or replace function public.record_seller_listing_response(
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
    response_type, feedback, listing_revision
  ) values (
    v_transaction.organization_id, p_transaction_id, v_contact_id, v_actor,
    p_response_type,
    case when p_response_type = 'changes_requested' then v_feedback else null end,
    v_transaction.listing_revision
  ) returning id into v_response_id;

  if p_response_type = 'changes_requested' and v_transaction.ready_for_publish_at is not null then
    perform private.invalidate_listing_publish_readiness(p_transaction_id, v_actor, false);
  end if;
  v_state := private.refresh_listing_readiness(p_transaction_id);
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, null,
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
      'customer_user_id', v_actor,
      'listing_revision', v_transaction.listing_revision,
      'readiness', v_state
    )
  );
  return v_response_id;
end;
$$;

create or replace function public.seller_listing_review(p_transaction_id uuid)
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
        and response.listing_revision = transaction.listing_revision
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

create function public.mark_listing_ready_for_publish(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
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
  if not private.listing_publish_requirements_met(p_transaction_id) then
    raise exception 'Listing publish requirements are not complete' using errcode = '23514';
  end if;
  if v_transaction.ready_for_publish_at is not null then
    return jsonb_build_object(
      'state', 'ready_to_publish',
      'ready_for_publish_at', v_transaction.ready_for_publish_at,
      'ready_for_publish_by', v_transaction.ready_for_publish_by
    );
  end if;

  update public.transactions
  set ready_for_publish_at = now(), ready_for_publish_by = v_actor
  where id = p_transaction_id;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'listing_marked_ready_for_publish', 'internal',
    'Listing marked ready for publish',
    jsonb_build_object('listing_revision', v_transaction.listing_revision)
  );

  return jsonb_build_object(
    'state', 'ready_to_publish',
    'ready_for_publish_at', (select ready_for_publish_at from public.transactions where id = p_transaction_id),
    'ready_for_publish_by', v_actor
  );
end;
$$;

revoke all on function public.mark_listing_ready_for_publish(uuid) from public, anon;
grant execute on function public.mark_listing_ready_for_publish(uuid) to authenticated;

comment on column public.transactions.listing_revision is
  'Increments when listing facts, content, document readiness, or property imagery changes.';
comment on column public.transactions.ready_for_publish_at is
  'Internal review marker only. It does not publish the listing externally.';
