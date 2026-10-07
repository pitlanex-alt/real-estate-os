-- Mó Phase 7A: internal listing preparation only.

alter table public.properties
  add column property_type text check (property_type is null or length(property_type) <= 80),
  add column floor integer check (floor is null or floor between -10 and 200),
  add column parking text check (parking is null or length(parking) <= 160),
  add column monthly_fees_isk bigint check (monthly_fees_isk is null or monthly_fees_isk >= 0);

alter table public.transactions
  add column listing_title text check (listing_title is null or length(listing_title) <= 180),
  add column listing_description text check (listing_description is null or length(listing_description) <= 20000),
  add column listing_highlights text[] not null default '{}',
  add column listing_seller_approved boolean not null default false,
  add column listing_documents_ready boolean not null default false,
  add column listing_readiness text not null default 'not_started'
    check (listing_readiness in ('not_started', 'in_progress', 'ready'));

create function private.refresh_listing_readiness(p_transaction_id uuid)
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

  if v_facts_complete
    and v_photos_uploaded
    and v_description_complete
    and v_transaction.listing_seller_approved
    and v_transaction.listing_documents_ready then
    v_state := 'ready';
  elsif v_property.property_type is not null
    or v_transaction.asking_price_isk is not null
    or v_transaction.listing_title is not null
    or v_transaction.listing_description is not null
    or cardinality(v_transaction.listing_highlights) > 0
    or v_photos_uploaded
    or v_transaction.listing_seller_approved
    or v_transaction.listing_documents_ready then
    v_state := 'in_progress';
  else
    v_state := 'not_started';
  end if;

  update public.transactions
  set listing_readiness = v_state
  where id = p_transaction_id;
  return v_state;
end;
$$;

revoke all on function private.refresh_listing_readiness(uuid) from public, anon, authenticated;

create function private.refresh_property_listing_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property_id uuid;
  v_transaction record;
begin
  if tg_op = 'DELETE' then
    v_property_id := old.property_id;
  else
    v_property_id := new.property_id;
  end if;
  for v_transaction in
    select id from public.transactions
    where property_id = v_property_id
      and stage not in ('completed', 'cancelled')
  loop
    perform private.refresh_listing_readiness(v_transaction.id);
  end loop;
  return null;
end;
$$;

create trigger property_images_refresh_listing_readiness
after insert or delete on public.property_images
for each row execute function private.refresh_property_listing_readiness();

do $$
declare v_transaction record;
begin
  for v_transaction in select id from public.transactions loop
    perform private.refresh_listing_readiness(v_transaction.id);
  end loop;
end $$;

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
  p_seller_approved boolean,
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
    listing_seller_approved = p_seller_approved,
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
  uuid,text,integer,text,bigint,text,text,text[],bigint,boolean,boolean
) from public, anon;
grant execute on function public.update_listing_preparation(
  uuid,text,integer,text,bigint,text,text,text[],bigint,boolean,boolean
) to authenticated;

comment on column public.transactions.listing_readiness is
  'Derived internal preparation state. It does not publish or approve a listing externally.';
