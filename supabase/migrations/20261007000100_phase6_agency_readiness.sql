-- Mó Phase 6: stable property routing, agency administration, CRM foundation,
-- internal onboarding, agent profiles, and private property imagery.

alter table public.organizations
  add column if not exists public_email extensions.citext,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists default_contact_name text,
  add column if not exists default_contact_email extensions.citext,
  add column if not exists default_contact_phone text,
  add column if not exists logo_storage_path text;

alter table public.profiles
  add column if not exists professional_title text,
  add column if not exists email extensions.citext,
  add column if not exists profile_photo_path text,
  add column if not exists account_type text not null default 'internal'
    check (account_type in ('internal', 'customer'));

update public.profiles profile
set email = auth_user.email
from auth.users auth_user
where auth_user.id = profile.id and profile.email is null;

update public.profiles profile
set account_type = case
  when exists (
    select 1 from public.organization_memberships membership
    where membership.user_id = profile.id
  ) then 'internal'
  when exists (
    select 1 from public.portal_access_grants grant_row
    where grant_row.user_id = profile.id
  ) then 'customer'
  else profile.account_type
end;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone, email, professional_title, account_type)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'Nýr notandi'), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'professional_title'), ''),
    case when new.raw_user_meta_data ->> 'account_type' = 'customer' then 'customer' else 'internal' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create function private.mark_portal_profile_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set account_type = 'customer'
  where id = new.user_id
    and not exists (
      select 1 from public.organization_memberships membership
      where membership.user_id = new.user_id
    );
  return new;
end;
$$;

create trigger portal_access_grants_mark_customer
after insert or update of user_id on public.portal_access_grants
for each row execute function private.mark_portal_profile_customer();

create function private.slug_base(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        translate(
          replace(replace(replace(replace(lower(coalesce(p_value, 'eign')), 'ð', 'd'), 'þ', 'th'), 'æ', 'ae'), 'ö', 'o'),
          'áéíóúý',
          'aeiouy'
        ),
        '[^a-z0-9]+', '-', 'g'
      )),
      ''
    ),
    'eign'
  );
$$;

alter table public.properties add column if not exists slug text;

do $$
declare
  v_property record;
  v_base text;
  v_slug text;
  v_suffix integer;
begin
  for v_property in
    select id, organization_id, address_line
    from public.properties
    where slug is null
    order by organization_id, created_at, id
  loop
    v_base := private.slug_base(v_property.address_line);
    v_slug := v_base;
    v_suffix := 1;
    while exists (
      select 1 from public.properties existing
      where existing.organization_id = v_property.organization_id
        and existing.slug = v_slug
        and existing.id <> v_property.id
    ) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base || '-' || v_suffix;
    end loop;
    update public.properties set slug = v_slug where id = v_property.id;
  end loop;
end $$;

alter table public.properties alter column slug set not null;
alter table public.properties add constraint properties_slug_format_check
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
create unique index properties_organization_slug_key
  on public.properties (organization_id, slug);

create function private.assign_property_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix integer := 1;
begin
  if nullif(trim(new.slug), '') is not null then
    new.slug := private.slug_base(new.slug);
    return new;
  end if;
  v_base := private.slug_base(new.address_line);
  v_candidate := v_base;
  while exists (
    select 1 from public.properties property
    where property.organization_id = new.organization_id
      and property.slug = v_candidate
      and property.id <> new.id
  ) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix;
  end loop;
  new.slug := v_candidate;
  return new;
end;
$$;

create trigger properties_assign_slug
before insert on public.properties
for each row execute function private.assign_property_slug();

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 15728640),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_cover boolean not null default false,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_images_property_id_fkey foreign key (property_id)
    references public.properties(id) on delete cascade,
  constraint property_images_property_org_fkey foreign key (property_id, organization_id)
    references public.properties(id, organization_id) on delete cascade,
  constraint property_images_uploader_membership_fkey foreign key (organization_id, uploaded_by)
    references public.organization_memberships(organization_id, user_id),
  unique (id, organization_id)
);

create unique index property_images_one_cover
  on public.property_images (property_id) where is_cover;
create index property_images_property_order_idx
  on public.property_images (property_id, sort_order, created_at);
create trigger property_images_set_updated_at before update on public.property_images
for each row execute function private.set_updated_at();

alter table public.property_images enable row level security;

create function private.can_read_property_image(
  p_property_id uuid,
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_org_member(p_organization_id, p_user_id) or exists (
    select 1 from public.transactions transaction
    where transaction.property_id = p_property_id
      and transaction.organization_id = p_organization_id
      and private.has_portal_access(
        transaction.id,
        array['seller', 'co_owner', 'accepted_buyer']::public.party_role[],
        p_user_id
      )
  );
$$;
revoke all on function private.can_read_property_image(uuid,uuid,uuid) from public,anon;
grant execute on function private.can_read_property_image(uuid,uuid,uuid) to authenticated;

create policy property_images_authorized_read on public.property_images
for select to authenticated using (private.can_read_property_image(property_id,organization_id));

revoke all on public.property_images from anon, authenticated;
grant select on public.property_images to authenticated;
grant update (display_name, phone, professional_title, email, profile_photo_path) on public.profiles to authenticated;

-- Active colleagues may inspect inactive teammates so team administration and
-- historical attribution remain readable after access is revoked.
create or replace function private.shares_org_with(p_other_user_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships mine
    join public.organization_memberships theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = p_user_id
      and mine.is_active
      and theirs.user_id = p_other_user_id
  );
$$;

create function private.can_manage_organization(p_organization_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_org_role(
    p_organization_id,
    array['admin']::public.organization_role[],
    p_user_id
  );
$$;

create function private.can_operate_organization(p_organization_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_org_role(
    p_organization_id,
    array['admin', 'agent', 'coordinator']::public.organization_role[],
    p_user_id
  );
$$;

revoke all on function private.can_manage_organization(uuid, uuid), private.can_operate_organization(uuid, uuid)
from public, anon;
grant execute on function private.can_manage_organization(uuid, uuid), private.can_operate_organization(uuid, uuid)
to authenticated;

create function public.create_internal_organization(
  p_name text,
  p_display_name text,
  p_professional_title text default null,
  p_phone text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := gen_random_uuid();
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if exists (select 1 from public.organization_memberships where user_id = v_user_id and is_active) then
    raise exception 'User already has an active organization' using errcode = '23514';
  end if;
  if exists (select 1 from public.profiles where id = v_user_id and account_type = 'customer') then
    raise exception 'Customer accounts cannot create organizations' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_display_name), '') is null then
    raise exception 'Organization and display name are required' using errcode = '22023';
  end if;
  insert into public.organizations (id, name) values (v_organization_id, trim(p_name));
  update public.profiles set
    display_name = trim(p_display_name),
    professional_title = nullif(trim(p_professional_title), ''),
    phone = nullif(trim(p_phone), ''),
    account_type = 'internal'
  where id = v_user_id;
  insert into public.organization_memberships (organization_id, user_id, role, is_active)
  values (v_organization_id, v_user_id, 'admin', true);
  return v_organization_id;
end $$;

create function public.update_organization_settings(
  p_organization_id uuid,
  p_name text,
  p_public_email extensions.citext,
  p_phone text,
  p_website text,
  p_address text,
  p_default_contact_name text,
  p_default_contact_email extensions.citext,
  p_default_contact_phone text,
  p_logo_storage_path text default null
)
returns public.organizations
language plpgsql security definer set search_path = '' as $$
declare v_result public.organizations%rowtype;
begin
  if not private.can_manage_organization(p_organization_id) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Name is required' using errcode = '22023'; end if;
  update public.organizations set
    name = trim(p_name),
    public_email = nullif(trim(p_public_email::text), '')::extensions.citext,
    phone = nullif(trim(p_phone), ''),
    website = nullif(trim(p_website), ''),
    address = nullif(trim(p_address), ''),
    default_contact_name = nullif(trim(p_default_contact_name), ''),
    default_contact_email = nullif(trim(p_default_contact_email::text), '')::extensions.citext,
    default_contact_phone = nullif(trim(p_default_contact_phone), ''),
    logo_storage_path = coalesce(nullif(trim(p_logo_storage_path), ''), logo_storage_path)
  where id = p_organization_id returning * into v_result;
  return v_result;
end $$;

create function public.update_own_profile(
  p_display_name text,
  p_professional_title text,
  p_phone text,
  p_email extensions.citext,
  p_profile_photo_path text default null
)
returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare v_result public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(p_display_name), '') is null then raise exception 'Display name is required' using errcode = '22023'; end if;
  update public.profiles set
    display_name = trim(p_display_name),
    professional_title = nullif(trim(p_professional_title), ''),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email::text), '')::extensions.citext,
    profile_photo_path = coalesce(nullif(trim(p_profile_photo_path), ''), profile_photo_path)
  where id = auth.uid() returning * into v_result;
  return v_result;
end $$;

create function public.set_team_membership(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role,
  p_is_active boolean
)
returns public.organization_memberships
language plpgsql security definer set search_path = '' as $$
declare
  v_result public.organization_memberships%rowtype;
  v_current public.organization_memberships%rowtype;
begin
  if not private.can_manage_organization(p_organization_id) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  select * into v_current from public.organization_memberships
  where organization_id = p_organization_id and user_id = p_user_id for update;
  if v_current.role = 'admin' and (p_role <> 'admin' or not p_is_active)
    and (select count(*) from public.organization_memberships where organization_id = p_organization_id and role = 'admin' and is_active) <= 1 then
    raise exception 'Organization must retain one active admin' using errcode = '23514';
  end if;
  insert into public.organization_memberships (organization_id, user_id, role, is_active)
  values (p_organization_id, p_user_id, p_role, p_is_active)
  on conflict (organization_id, user_id) do update set role = excluded.role, is_active = excluded.is_active
  returning * into v_result;
  update public.profiles set account_type = 'internal' where id = p_user_id;
  return v_result;
end $$;

create function public.create_contact(
  p_organization_id uuid,
  p_full_name text,
  p_email extensions.citext default null,
  p_phone text default null
)
returns public.contacts
language plpgsql security definer set search_path = '' as $$
declare v_result public.contacts%rowtype;
begin
  if not private.can_operate_organization(p_organization_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'Name is required' using errcode = '22023'; end if;
  insert into public.contacts (organization_id, full_name, email, phone, created_by)
  values (p_organization_id, trim(p_full_name), nullif(trim(p_email::text), '')::extensions.citext, nullif(trim(p_phone), ''), auth.uid())
  returning * into v_result;
  return v_result;
end $$;

create function public.update_contact(
  p_contact_id uuid,
  p_full_name text,
  p_email extensions.citext,
  p_phone text
)
returns public.contacts
language plpgsql security definer set search_path = '' as $$
declare v_result public.contacts%rowtype;
begin
  select * into v_result from public.contacts where id = p_contact_id;
  if not found or not private.can_operate_organization(v_result.organization_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  update public.contacts set full_name = trim(p_full_name), email = nullif(trim(p_email::text), '')::extensions.citext, phone = nullif(trim(p_phone), '')
  where id = p_contact_id returning * into v_result;
  return v_result;
end $$;

create function public.create_property_image_record(
  p_property_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_is_cover boolean default false
)
returns public.property_images
language plpgsql security definer set search_path = '' as $$
declare v_property public.properties%rowtype; v_result public.property_images%rowtype; v_cover boolean;
begin
  select * into v_property from public.properties where id = p_property_id;
  if not found or not private.can_operate_organization(v_property.organization_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif') or p_file_size_bytes <= 0 or p_file_size_bytes > 15728640 then
    raise exception 'Unsupported image' using errcode = '22023';
  end if;
  v_cover := p_is_cover or not exists (select 1 from public.property_images where property_id = p_property_id);
  if v_cover then update public.property_images set is_cover = false where property_id = p_property_id; end if;
  insert into public.property_images (organization_id, property_id, storage_path, file_name, mime_type, file_size_bytes, sort_order, is_cover, uploaded_by)
  values (v_property.organization_id, p_property_id, trim(p_storage_path), trim(p_file_name), p_mime_type, p_file_size_bytes,
    coalesce((select max(sort_order) + 1 from public.property_images where property_id = p_property_id), 0), v_cover, auth.uid())
  returning * into v_result;
  return v_result;
end $$;

create function public.set_property_image_cover(p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_image public.property_images%rowtype;
begin
  select * into v_image from public.property_images where id = p_image_id for update;
  if not found or not private.can_operate_organization(v_image.organization_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  update public.property_images set is_cover = false where property_id = v_image.property_id;
  update public.property_images set is_cover = true where id = p_image_id;
end $$;

create function public.reorder_property_image(p_image_id uuid, p_sort_order integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_image public.property_images%rowtype; v_neighbor public.property_images%rowtype;
begin
  select * into v_image from public.property_images where id = p_image_id for update;
  if not found or not private.can_operate_organization(v_image.organization_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_sort_order < v_image.sort_order then
    select * into v_neighbor from public.property_images
    where property_id=v_image.property_id and id<>v_image.id and sort_order<v_image.sort_order
    order by sort_order desc,created_at desc limit 1 for update;
  elsif p_sort_order > v_image.sort_order then
    select * into v_neighbor from public.property_images
    where property_id=v_image.property_id and id<>v_image.id and sort_order>v_image.sort_order
    order by sort_order,created_at limit 1 for update;
  else
    return;
  end if;
  if v_neighbor.id is null then return; end if;
  update public.property_images set sort_order=v_image.sort_order where id=v_neighbor.id;
  update public.property_images set sort_order=v_neighbor.sort_order where id=v_image.id;
end $$;

create function public.delete_property_image_record(p_image_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_image public.property_images%rowtype; v_next uuid;
begin
  select * into v_image from public.property_images where id = p_image_id for update;
  if not found or not private.can_operate_organization(v_image.organization_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.property_images where id = p_image_id;
  if v_image.is_cover then
    select id into v_next from public.property_images where property_id = v_image.property_id order by sort_order, created_at limit 1;
    if v_next is not null then update public.property_images set is_cover = true where id = v_next; end if;
  end if;
end $$;

-- Replace the Phase 1 creator with the production-ready signature. The actor and
-- organization are derived/validated in the database and all records remain atomic.
drop function if exists public.create_property_transaction(
  uuid, text, text, extensions.citext, text, text, text, text,
  numeric, numeric, integer, integer, bigint, text, text, extensions.citext
);

create function public.create_property_transaction(
  p_organization_id uuid,
  p_seller_contact_id uuid,
  p_seller_name text,
  p_seller_phone text,
  p_seller_email extensions.citext,
  p_address_line text,
  p_postal_code text,
  p_municipality text,
  p_registry_number text,
  p_size_sqm numeric,
  p_room_count numeric,
  p_bedroom_count integer,
  p_year_built integer,
  p_asking_price_isk bigint,
  p_assigned_agent_id uuid,
  p_initial_stage public.transaction_stage,
  p_co_owner_name text,
  p_co_owner_phone text,
  p_co_owner_email extensions.citext
)
returns table (transaction_id uuid, property_id uuid, property_slug text)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid(); v_organization_id uuid; v_property_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid(); v_seller_id uuid; v_co_owner_id uuid; v_agent_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_organization_id := p_organization_id;
  if v_organization_id is null then
    select organization_id into v_organization_id from public.organization_memberships
    where user_id = v_user_id and is_active and role in ('admin','agent','coordinator')
    order by created_at limit 1;
  end if;
  if not private.can_operate_organization(v_organization_id, v_user_id) then raise exception 'No writable membership' using errcode = '42501'; end if;
  v_agent_id := coalesce(p_assigned_agent_id, v_user_id);
  if not exists (select 1 from public.organization_memberships where organization_id = v_organization_id and user_id = v_agent_id and is_active and role in ('admin','agent')) then
    raise exception 'Primary agent must be an active admin or agent' using errcode = '42501';
  end if;
  if p_initial_stage not in ('valuation','preparation') then raise exception 'Initial stage must be valuation or preparation' using errcode = '23514'; end if;
  if nullif(trim(p_address_line),'') is null or nullif(trim(p_postal_code),'') is null or nullif(trim(p_municipality),'') is null then raise exception 'Property location is required' using errcode = '22023'; end if;
  if p_seller_contact_id is not null then
    select id into v_seller_id from public.contacts where id = p_seller_contact_id and organization_id = v_organization_id;
    if v_seller_id is null then raise exception 'Seller contact not found' using errcode = 'P0002'; end if;
  else
    if nullif(trim(p_seller_name),'') is null then raise exception 'Seller is required' using errcode = '22023'; end if;
    insert into public.contacts (organization_id,full_name,phone,email,created_by)
    values(v_organization_id,trim(p_seller_name),nullif(trim(p_seller_phone),''),nullif(trim(p_seller_email::text),'')::extensions.citext,v_user_id)
    returning id into v_seller_id;
  end if;
  insert into public.properties (id,organization_id,address_line,postal_code,municipality,registry_number,size_sqm,room_count,bedroom_count,year_built)
  values(v_property_id,v_organization_id,trim(p_address_line),trim(p_postal_code),trim(p_municipality),nullif(trim(p_registry_number),''),p_size_sqm,p_room_count,p_bedroom_count,p_year_built);
  insert into public.transactions (id,organization_id,property_id,assigned_agent_id,stage,asking_price_isk,created_by)
  values(v_transaction_id,v_organization_id,v_property_id,v_agent_id,p_initial_stage,p_asking_price_isk,v_user_id);
  insert into public.transaction_assignments (organization_id,transaction_id,user_id,role)
  values(v_organization_id,v_transaction_id,v_agent_id,'primary_agent');
  insert into public.transaction_parties (organization_id,transaction_id,contact_id,role,is_primary)
  values(v_organization_id,v_transaction_id,v_seller_id,'seller',true);
  if nullif(trim(p_co_owner_name),'') is not null then
    insert into public.contacts (organization_id,full_name,phone,email,created_by)
    values(v_organization_id,trim(p_co_owner_name),nullif(trim(p_co_owner_phone),''),nullif(trim(p_co_owner_email::text),'')::extensions.citext,v_user_id)
    returning id into v_co_owner_id;
    insert into public.transaction_parties (organization_id,transaction_id,contact_id,role,is_primary)
    values(v_organization_id,v_transaction_id,v_co_owner_id,'co_owner',false);
  end if;
  insert into public.transaction_stage_history(organization_id,transaction_id,from_stage,to_stage,changed_by,reason)
  values(v_organization_id,v_transaction_id,null,p_initial_stage,v_user_id,'Initial transaction stage');
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_organization_id,v_transaction_id,v_user_id,'transaction_created','internal','Property transaction created',jsonb_build_object('property_id',v_property_id));
  return query select v_transaction_id,v_property_id,(select slug from public.properties where id=v_property_id);
end $$;

revoke all on function public.create_internal_organization(text,text,text,text),
  public.update_organization_settings(uuid,text,extensions.citext,text,text,text,text,extensions.citext,text,text),
  public.update_own_profile(text,text,text,extensions.citext,text),
  public.set_team_membership(uuid,uuid,public.organization_role,boolean),
  public.create_contact(uuid,text,extensions.citext,text),
  public.update_contact(uuid,text,extensions.citext,text),
  public.create_property_image_record(uuid,text,text,text,bigint,boolean),
  public.set_property_image_cover(uuid), public.reorder_property_image(uuid,integer),
  public.delete_property_image_record(uuid),
  public.create_property_transaction(uuid,uuid,text,text,extensions.citext,text,text,text,text,numeric,numeric,integer,integer,bigint,uuid,public.transaction_stage,text,text,extensions.citext)
from public, anon;

grant execute on function public.create_internal_organization(text,text,text,text),
  public.update_organization_settings(uuid,text,extensions.citext,text,text,text,text,extensions.citext,text,text),
  public.update_own_profile(text,text,text,extensions.citext,text),
  public.set_team_membership(uuid,uuid,public.organization_role,boolean),
  public.create_contact(uuid,text,extensions.citext,text),
  public.update_contact(uuid,text,extensions.citext,text),
  public.create_property_image_record(uuid,text,text,text,bigint,boolean),
  public.set_property_image_cover(uuid), public.reorder_property_image(uuid,integer),
  public.delete_property_image_record(uuid),
  public.create_property_transaction(uuid,uuid,text,text,extensions.citext,text,text,text,text,numeric,numeric,integer,integer,bigint,uuid,public.transaction_stage,text,text,extensions.citext)
to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('property-images','property-images',false,15728640,array['image/jpeg','image/png','image/webp','image/avif']),
  ('agency-assets','agency-assets',false,5242880,array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy property_images_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id='property-images'
  and private.can_operate_organization((storage.foldername(name))[2]::uuid)
  and exists (
    select 1 from public.properties property
    where property.organization_id=(storage.foldername(name))[2]::uuid
      and property.id=(storage.foldername(name))[4]::uuid
  )
);
create policy property_images_storage_read on storage.objects for select to authenticated using (
  bucket_id='property-images' and exists (
    select 1 from public.property_images image
    where image.storage_path=name
      and private.can_read_property_image(image.property_id,image.organization_id)
  )
);
create policy property_images_storage_delete on storage.objects for delete to authenticated using (
  bucket_id='property-images' and exists (
    select 1 from public.property_images image
    where image.storage_path=name and private.can_operate_organization(image.organization_id)
  )
);
create policy agency_assets_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id='agency-assets' and private.can_manage_organization((storage.foldername(name))[2]::uuid)
);
create policy agency_assets_profile_insert on storage.objects for insert to authenticated with check (
  bucket_id='agency-assets'
  and (storage.foldername(name))[1]='organizations'
  and (storage.foldername(name))[3]='profiles'
  and (storage.foldername(name))[4]::uuid=auth.uid()
  and private.is_org_member((storage.foldername(name))[2]::uuid)
);
create policy agency_assets_member_read on storage.objects for select to authenticated using (
  bucket_id='agency-assets' and private.is_org_member((storage.foldername(name))[2]::uuid)
);
create policy agency_assets_admin_delete on storage.objects for delete to authenticated using (
  bucket_id='agency-assets' and private.can_manage_organization((storage.foldername(name))[2]::uuid)
);
create policy agency_assets_profile_delete on storage.objects for delete to authenticated using (
  bucket_id='agency-assets'
  and (storage.foldername(name))[3]='profiles'
  and (storage.foldername(name))[4]::uuid=auth.uid()
  and private.is_org_member((storage.foldername(name))[2]::uuid)
);

comment on table public.property_images is 'Private property image metadata. Customer access is transaction-grant scoped.';
comment on column public.properties.slug is 'Stable human-readable route key, unique within an organization.';

drop function if exists public.customer_portal_destinations();
create function public.customer_portal_destinations()
returns table (
  transaction_id uuid,
  role public.party_role,
  property_slug text,
  address text,
  postal_code text,
  municipality text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return query
  select grant_row.transaction_id, grant_row.role, property.slug,
    property.address_line, property.postal_code, property.municipality
  from public.portal_access_grants grant_row
  join public.transactions transaction on transaction.id=grant_row.transaction_id and transaction.organization_id=grant_row.organization_id
  join public.properties property on property.id=transaction.property_id and property.organization_id=grant_row.organization_id
  where grant_row.user_id=auth.uid() and grant_row.status='active' and grant_row.revoked_at is null
    and grant_row.role in ('seller','co_owner','accepted_buyer')
  order by grant_row.activated_at desc,grant_row.created_at desc,grant_row.id;
end $$;
revoke all on function public.customer_portal_destinations() from public,anon;
grant execute on function public.customer_portal_destinations() to authenticated;

create function public.customer_property_images(p_transaction_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not private.has_portal_access(p_transaction_id,array['seller','co_owner','accepted_buyer']::public.party_role[]) then
    raise exception 'Portal access denied' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',image.id,'storage_path',image.storage_path,'file_name',image.file_name,'sort_order',image.sort_order,'is_cover',image.is_cover) order by image.sort_order,image.created_at) from public.property_images image join public.transactions transaction on transaction.property_id=image.property_id where transaction.id=p_transaction_id),'[]'::jsonb);
end $$;
revoke all on function public.customer_property_images(uuid) from public,anon;
grant execute on function public.customer_property_images(uuid) to authenticated;

create function public.customer_agent_profile(p_transaction_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not private.has_portal_access(p_transaction_id,array['seller','co_owner','accepted_buyer']::public.party_role[]) then raise exception 'Portal access denied' using errcode='42501'; end if;
  select jsonb_build_object('name',profile.display_name,'title',profile.professional_title,'phone',profile.phone,'email',profile.email)
  into v_result from public.transactions transaction join public.profiles profile on profile.id=transaction.assigned_agent_id where transaction.id=p_transaction_id;
  return v_result;
end $$;
revoke all on function public.customer_agent_profile(uuid) from public,anon;
grant execute on function public.customer_agent_profile(uuid) to authenticated;
