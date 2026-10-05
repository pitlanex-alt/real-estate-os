create extension if not exists citext with schema extensions;

create type public.organization_role as enum ('admin', 'agent', 'coordinator', 'viewer');
create type public.transaction_stage as enum (
  'valuation',
  'preparation',
  'listed',
  'viewings',
  'offers',
  'contract',
  'closing',
  'handover',
  'completed',
  'cancelled'
);
create type public.transaction_assignment_role as enum ('primary_agent', 'co_agent', 'coordinator');
create type public.party_role as enum ('seller', 'co_owner', 'representative', 'accepted_buyer');
create type public.activity_visibility as enum ('internal', 'seller', 'buyer', 'seller_and_buyer');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  address_line text not null check (length(trim(address_line)) > 0),
  postal_code text not null check (length(trim(postal_code)) > 0),
  municipality text not null check (length(trim(municipality)) > 0),
  registry_number text,
  size_sqm numeric(10, 2) check (size_sqm is null or size_sqm > 0),
  room_count numeric(4, 1) check (room_count is null or room_count > 0),
  bedroom_count integer check (bedroom_count is null or bedroom_count >= 0),
  year_built integer check (year_built is null or year_built between 1700 and 2200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);

create unique index properties_org_registry_number_key
  on public.properties (organization_id, registry_number)
  where registry_number is not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null,
  assigned_agent_id uuid not null references public.profiles(id),
  stage public.transaction_stage not null default 'preparation',
  asking_price_isk bigint check (asking_price_isk is null or asking_price_isk >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_property_id_fkey
    foreign key (property_id) references public.properties(id),
  constraint transactions_property_org_fkey
    foreign key (property_id, organization_id)
    references public.properties(id, organization_id),
  constraint transactions_assigned_agent_membership_fkey
    foreign key (organization_id, assigned_agent_id)
    references public.organization_memberships(organization_id, user_id)
    deferrable initially deferred,
  constraint transactions_created_by_membership_fkey
    foreign key (organization_id, created_by)
    references public.organization_memberships(organization_id, user_id)
    deferrable initially deferred,
  unique (id, organization_id)
);

create table public.transaction_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  user_id uuid not null references public.profiles(id),
  role public.transaction_assignment_role not null,
  created_at timestamptz not null default now(),
  constraint transaction_assignments_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint transaction_assignments_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint transaction_assignments_membership_fkey
    foreign key (organization_id, user_id)
    references public.organization_memberships(organization_id, user_id),
  primary key (transaction_id, user_id, role)
);

create unique index transaction_assignments_one_primary_agent
  on public.transaction_assignments (transaction_id)
  where role = 'primary_agent';

create table public.transaction_stage_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  from_stage public.transaction_stage,
  to_stage public.transaction_stage not null,
  changed_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  constraint transaction_stage_history_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint transaction_stage_history_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint transaction_stage_history_actor_membership_fkey
    foreign key (organization_id, changed_by)
    references public.organization_memberships(organization_id, user_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text,
  email extensions.citext,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_created_by_membership_fkey
    foreign key (organization_id, created_by)
    references public.organization_memberships(organization_id, user_id),
  unique (id, organization_id)
);

create table public.transaction_parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  contact_id uuid not null,
  role public.party_role not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint transaction_parties_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint transaction_parties_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint transaction_parties_contact_id_fkey
    foreign key (contact_id) references public.contacts(id),
  constraint transaction_parties_contact_org_fkey
    foreign key (contact_id, organization_id)
    references public.contacts(id, organization_id),
  unique (transaction_id, contact_id, role)
);

create unique index transaction_parties_one_primary_seller
  on public.transaction_parties (transaction_id)
  where role = 'seller' and is_primary;

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  actor_user_id uuid references public.profiles(id),
  event_type text not null check (length(trim(event_type)) > 0),
  visibility public.activity_visibility not null default 'internal',
  summary text not null check (length(trim(summary)) > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint activity_events_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint activity_events_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint activity_events_actor_membership_fkey
    foreign key (organization_id, actor_user_id)
    references public.organization_memberships(organization_id, user_id)
);

create index organization_memberships_user_idx on public.organization_memberships (user_id) where is_active;
create index properties_organization_idx on public.properties (organization_id);
create index transactions_organization_stage_idx on public.transactions (organization_id, stage);
create index transactions_property_idx on public.transactions (property_id);
create index transaction_assignments_user_idx on public.transaction_assignments (user_id);
create index transaction_stage_history_transaction_created_idx on public.transaction_stage_history (transaction_id, created_at desc);
create index contacts_organization_name_idx on public.contacts (organization_id, full_name);
create index transaction_parties_contact_idx on public.transaction_parties (contact_id);
create index activity_events_transaction_created_idx on public.activity_events (transaction_id, created_at desc);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on public.organizations
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger organization_memberships_set_updated_at before update on public.organization_memberships
for each row execute function private.set_updated_at();
create trigger properties_set_updated_at before update on public.properties
for each row execute function private.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function private.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, 'Nýr notandi'), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, display_name, phone, created_at, updated_at)
select
  id,
  coalesce(
    nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(email, 'Nýr notandi'), '@', 1)
  ),
  nullif(trim(raw_user_meta_data ->> 'phone'), ''),
  created_at,
  now()
from auth.users
on conflict (id) do nothing;

create function private.is_org_member(p_organization_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.is_active
  );
$$;

create function private.has_org_role(
  p_organization_id uuid,
  p_allowed_roles public.organization_role[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.is_active
      and membership.role = any(p_allowed_roles)
  );
$$;

create function private.shares_org_with(p_other_user_id uuid, p_user_id uuid default auth.uid())
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
      and theirs.is_active
  );
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid, uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.organization_role[], uuid) to authenticated;
grant execute on function private.shares_org_with(uuid, uuid) to authenticated;

create function private.enforce_primary_agent_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_assigned_agent_id uuid;
  v_primary_agent_id uuid;
  v_primary_count integer;
begin
  if tg_table_name = 'transactions' then
    v_transaction_id := coalesce(new.id, old.id);
  else
    v_transaction_id := coalesce(new.transaction_id, old.transaction_id);
  end if;

  select transaction.assigned_agent_id
  into v_assigned_agent_id
  from public.transactions transaction
  where transaction.id = v_transaction_id;

  if not found then
    return null;
  end if;

  select count(*), min(assignment.user_id::text)::uuid
  into v_primary_count, v_primary_agent_id
  from public.transaction_assignments assignment
  where assignment.transaction_id = v_transaction_id
    and assignment.role = 'primary_agent';

  if v_primary_count <> 1 or v_primary_agent_id is distinct from v_assigned_agent_id then
    raise exception 'Transaction % must have exactly one primary assignment matching assigned_agent_id', v_transaction_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger transactions_primary_agent_consistency
after insert or update of assigned_agent_id on public.transactions
deferrable initially deferred
for each row execute function private.enforce_primary_agent_consistency();

create constraint trigger assignments_primary_agent_consistency
after insert or update or delete on public.transaction_assignments
deferrable initially deferred
for each row execute function private.enforce_primary_agent_consistency();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.properties enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_assignments enable row level security;
alter table public.transaction_stage_history enable row level security;
alter table public.contacts enable row level security;
alter table public.transaction_parties enable row level security;
alter table public.activity_events enable row level security;

create policy organizations_select_members on public.organizations
for select to authenticated
using (private.is_org_member(id));

create policy profiles_select_self_or_colleague on public.profiles
for select to authenticated
using (id = auth.uid() or private.shares_org_with(id));

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy organization_memberships_select_members on public.organization_memberships
for select to authenticated
using (private.is_org_member(organization_id));

create policy properties_select_members on public.properties
for select to authenticated
using (private.is_org_member(organization_id));

create policy transactions_select_members on public.transactions
for select to authenticated
using (private.is_org_member(organization_id));

create policy transaction_assignments_select_members on public.transaction_assignments
for select to authenticated
using (private.is_org_member(organization_id));

create policy transaction_stage_history_select_members on public.transaction_stage_history
for select to authenticated
using (private.is_org_member(organization_id));

create policy contacts_select_members on public.contacts
for select to authenticated
using (private.is_org_member(organization_id));

create policy transaction_parties_select_members on public.transaction_parties
for select to authenticated
using (private.is_org_member(organization_id));

create policy activity_events_select_members on public.activity_events
for select to authenticated
using (private.is_org_member(organization_id));

revoke all on public.organizations, public.profiles, public.organization_memberships,
  public.properties, public.transactions, public.transaction_assignments,
  public.transaction_stage_history, public.contacts, public.transaction_parties,
  public.activity_events from anon, authenticated;
grant select on public.organizations, public.profiles, public.organization_memberships,
  public.properties, public.transactions, public.transaction_assignments,
  public.transaction_stage_history, public.contacts, public.transaction_parties,
  public.activity_events to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

create function public.advance_transaction_stage(
  p_transaction_id uuid,
  p_next_stage public.transaction_stage,
  p_reason text default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_from_stage public.transaction_stage;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_transaction
  from public.transactions transaction
  where transaction.id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  if not private.has_org_role(
    v_transaction.organization_id,
    array['admin', 'coordinator']::public.organization_role[],
    v_user_id
  ) and not exists (
    select 1
    from public.transaction_assignments assignment
    join public.organization_memberships membership
      on membership.organization_id = assignment.organization_id
      and membership.user_id = assignment.user_id
      and membership.is_active
    where assignment.transaction_id = p_transaction_id
      and assignment.user_id = v_user_id
  ) then
    raise exception 'Not authorized to advance this transaction' using errcode = '42501';
  end if;

  v_allowed := case v_transaction.stage
    when 'valuation' then p_next_stage in ('preparation', 'cancelled')
    when 'preparation' then p_next_stage in ('valuation', 'listed', 'cancelled')
    when 'listed' then p_next_stage in ('preparation', 'viewings', 'cancelled')
    when 'viewings' then p_next_stage in ('listed', 'offers', 'cancelled')
    when 'offers' then p_next_stage in ('viewings', 'contract', 'cancelled')
    when 'contract' then p_next_stage in ('offers', 'closing', 'cancelled')
    when 'closing' then p_next_stage in ('contract', 'handover', 'cancelled')
    when 'handover' then p_next_stage in ('closing', 'completed', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'Stage transition from % to % is not allowed', v_transaction.stage, p_next_stage
      using errcode = '23514';
  end if;

  v_from_stage := v_transaction.stage;

  update public.transactions
  set stage = p_next_stage,
      completed_at = case when p_next_stage = 'completed' then now() else completed_at end
  where id = p_transaction_id
  returning * into v_transaction;

  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason
  ) values (
    v_transaction.organization_id, p_transaction_id, v_from_stage, p_next_stage, v_user_id, nullif(trim(p_reason), '')
  );

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata
  ) values (
    v_transaction.organization_id,
    p_transaction_id,
    v_user_id,
    'transaction_stage_advanced',
    'internal',
    format('Transaction stage changed to %s', p_next_stage),
    jsonb_build_object('from_stage', v_from_stage, 'to_stage', p_next_stage, 'reason', nullif(trim(p_reason), ''))
  );

  return v_transaction;
end;
$$;

create function public.create_property_transaction(
  p_organization_id uuid,
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
  p_co_owner_name text,
  p_co_owner_phone text,
  p_co_owner_email extensions.citext
)
returns table (transaction_id uuid, property_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_org_count integer;
  v_property_id uuid := gen_random_uuid();
  v_transaction_id uuid := gen_random_uuid();
  v_seller_contact_id uuid := gen_random_uuid();
  v_co_owner_contact_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_organization_id is null then
    select count(*), min(membership.organization_id::text)::uuid
    into v_org_count, v_organization_id
    from public.organization_memberships membership
    where membership.user_id = v_user_id
      and membership.is_active
      and membership.role in ('admin', 'agent', 'coordinator');

    if v_org_count <> 1 then
      raise exception 'An organization must be selected when the user has zero or multiple writable memberships'
        using errcode = '22023';
    end if;
  else
    v_organization_id := p_organization_id;
    if not private.has_org_role(
      v_organization_id,
      array['admin', 'agent', 'coordinator']::public.organization_role[],
      v_user_id
    ) then
      raise exception 'No writable membership for the selected organization' using errcode = '42501';
    end if;
  end if;

  if nullif(trim(p_seller_name), '') is null
    or nullif(trim(p_address_line), '') is null
    or nullif(trim(p_postal_code), '') is null
    or nullif(trim(p_municipality), '') is null then
    raise exception 'Seller name, address, postal code, and municipality are required'
      using errcode = '22023';
  end if;

  if p_asking_price_isk is not null and p_asking_price_isk < 0 then
    raise exception 'Asking price cannot be negative' using errcode = '22023';
  end if;

  insert into public.properties (
    id, organization_id, address_line, postal_code, municipality,
    registry_number, size_sqm, room_count, bedroom_count, year_built
  ) values (
    v_property_id,
    v_organization_id,
    trim(p_address_line),
    trim(p_postal_code),
    trim(p_municipality),
    nullif(trim(p_registry_number), ''),
    p_size_sqm,
    p_room_count,
    p_bedroom_count,
    p_year_built
  );

  insert into public.contacts (
    id, organization_id, full_name, phone, email, created_by
  ) values (
    v_seller_contact_id,
    v_organization_id,
    trim(p_seller_name),
    nullif(trim(p_seller_phone), ''),
    nullif(trim(p_seller_email::text), '')::extensions.citext,
    v_user_id
  );

  insert into public.transactions (
    id, organization_id, property_id, assigned_agent_id, stage,
    asking_price_isk, started_at, created_by
  ) values (
    v_transaction_id,
    v_organization_id,
    v_property_id,
    v_user_id,
    'preparation',
    p_asking_price_isk,
    now(),
    v_user_id
  );

  insert into public.transaction_assignments (
    organization_id, transaction_id, user_id, role
  ) values (
    v_organization_id, v_transaction_id, v_user_id, 'primary_agent'
  );

  insert into public.transaction_parties (
    organization_id, transaction_id, contact_id, role, is_primary
  ) values (
    v_organization_id, v_transaction_id, v_seller_contact_id, 'seller', true
  );

  if nullif(trim(p_co_owner_name), '') is not null then
    v_co_owner_contact_id := gen_random_uuid();
    insert into public.contacts (
      id, organization_id, full_name, phone, email, created_by
    ) values (
      v_co_owner_contact_id,
      v_organization_id,
      trim(p_co_owner_name),
      nullif(trim(p_co_owner_phone), ''),
      nullif(trim(p_co_owner_email::text), '')::extensions.citext,
      v_user_id
    );

    insert into public.transaction_parties (
      organization_id, transaction_id, contact_id, role, is_primary
    ) values (
      v_organization_id, v_transaction_id, v_co_owner_contact_id, 'co_owner', false
    );
  end if;

  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason
  ) values (
    v_organization_id, v_transaction_id, null, 'preparation', v_user_id, 'Initial transaction stage'
  );

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary,
    metadata
  ) values (
    v_organization_id,
    v_transaction_id,
    v_user_id,
    'transaction_created',
    'internal',
    'Property transaction created in preparation',
    jsonb_build_object('property_id', v_property_id)
  );

  return query select v_transaction_id, v_property_id;
end;
$$;

revoke all on function public.advance_transaction_stage(uuid, public.transaction_stage, text) from public, anon;
grant execute on function public.advance_transaction_stage(uuid, public.transaction_stage, text) to authenticated;
revoke all on function public.create_property_transaction(
  uuid, text, text, extensions.citext, text, text, text, text,
  numeric, numeric, integer, integer, bigint, text, text, extensions.citext
) from public, anon;
grant execute on function public.create_property_transaction(
  uuid, text, text, extensions.citext, text, text, text, text,
  numeric, numeric, integer, integer, bigint, text, text, extensions.citext
) to authenticated;
