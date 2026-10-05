do $$
begin
  if not exists (select 1 from pg_type where typname = 'viewing_status' and typnamespace = 'public'::regnamespace) then
    create type public.viewing_status as enum ('scheduled', 'active', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status' and typnamespace = 'public'::regnamespace) then
    create type public.attendance_status as enum ('registered', 'attended', 'no_show');
  end if;
  if not exists (select 1 from pg_type where typname = 'interest_level' and typnamespace = 'public'::regnamespace) then
    create type public.interest_level as enum ('very_interested', 'interested', 'unsure', 'not_interested', 'unset');
  end if;
end
$$;

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  viewing_type text not null check (length(trim(viewing_type)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.viewing_status not null default 'scheduled',
  created_by uuid not null references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viewings_time_order_check check (ends_at > starts_at),
  constraint viewings_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint viewings_transaction_id_fkey
    foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint viewings_transaction_org_fkey
    foreign key (transaction_id, organization_id)
    references public.transactions(id, organization_id) on delete cascade,
  constraint viewings_created_by_membership_fkey
    foreign key (organization_id, created_by)
    references public.organization_memberships(organization_id, user_id),
  unique (id, organization_id)
);

create table public.viewing_guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  viewing_id uuid not null,
  contact_id uuid not null,
  attendance public.attendance_status not null default 'registered',
  interest public.interest_level not null default 'unset',
  internal_notes text not null default '',
  next_action text,
  follow_up_due_at timestamptz,
  is_walk_in boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viewing_guests_walk_in_attendance_check check (
    not is_walk_in or attendance = 'attended'
  ),
  constraint viewing_guests_viewing_id_fkey
    foreign key (viewing_id) references public.viewings(id) on delete cascade,
  constraint viewing_guests_viewing_org_fkey
    foreign key (viewing_id, organization_id)
    references public.viewings(id, organization_id) on delete cascade,
  constraint viewing_guests_contact_id_fkey
    foreign key (contact_id) references public.contacts(id),
  constraint viewing_guests_contact_org_fkey
    foreign key (contact_id, organization_id)
    references public.contacts(id, organization_id),
  constraint viewing_guests_created_by_membership_fkey
    foreign key (organization_id, created_by)
    references public.organization_memberships(organization_id, user_id),
  unique (viewing_id, contact_id)
);

create index viewings_transaction_starts_idx
  on public.viewings (transaction_id, starts_at desc);
create index viewings_organization_status_idx
  on public.viewings (organization_id, status);
create index viewing_guests_viewing_idx
  on public.viewing_guests (viewing_id, created_at);
create index viewing_guests_contact_idx
  on public.viewing_guests (contact_id);

create trigger viewings_set_updated_at
before update on public.viewings
for each row execute function private.set_updated_at();

create trigger viewing_guests_set_updated_at
before update on public.viewing_guests
for each row execute function private.set_updated_at();

alter table public.viewings enable row level security;
alter table public.viewing_guests enable row level security;

create policy viewings_select_members on public.viewings
for select to authenticated
using (private.is_org_member(organization_id));

create policy viewing_guests_select_members on public.viewing_guests
for select to authenticated
using (private.is_org_member(organization_id));

revoke all on public.viewings, public.viewing_guests from anon, authenticated;
grant select on public.viewings, public.viewing_guests to authenticated;

create function private.can_manage_transaction(p_transaction_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.transactions transaction
    join public.organization_memberships membership
      on membership.organization_id = transaction.organization_id
      and membership.user_id = p_user_id
      and membership.is_active
    where transaction.id = p_transaction_id
      and (
        membership.role in ('admin', 'coordinator')
        or exists (
          select 1
          from public.transaction_assignments assignment
          where assignment.transaction_id = transaction.id
            and assignment.user_id = p_user_id
        )
      )
  );
$$;

revoke all on function private.can_manage_transaction(uuid, uuid) from public, anon;
grant execute on function private.can_manage_transaction(uuid, uuid) to authenticated;

create function public.create_viewing(
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
  v_viewing public.viewings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select transaction.organization_id
  into v_organization_id
  from public.transactions transaction
  where transaction.id = p_transaction_id;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
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
    v_organization_id,
    p_transaction_id,
    v_user_id,
    'viewing_created',
    'internal',
    'Viewing created',
    jsonb_build_object('viewing_id', v_viewing.id, 'starts_at', p_starts_at)
  );

  return v_viewing;
end;
$$;

create function public.register_viewing_guest(
  p_viewing_id uuid,
  p_contact_id uuid,
  p_full_name text,
  p_phone text,
  p_email extensions.citext,
  p_attendance public.attendance_status default 'registered',
  p_interest public.interest_level default 'unset',
  p_internal_notes text default '',
  p_next_action text default null,
  p_follow_up_due_at timestamptz default null,
  p_is_walk_in boolean default false
)
returns table (viewing_guest_id uuid, contact_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_transaction_id uuid;
  v_contact_id uuid := p_contact_id;
  v_guest_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select viewing.organization_id, viewing.transaction_id
  into v_organization_id, v_transaction_id
  from public.viewings viewing
  where viewing.id = p_viewing_id;

  if not found then
    raise exception 'Viewing not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_transaction(v_transaction_id, v_user_id) then
    raise exception 'Not authorized to manage this viewing' using errcode = '42501';
  end if;

  if v_contact_id is not null then
    if not exists (
      select 1 from public.contacts contact
      where contact.id = v_contact_id and contact.organization_id = v_organization_id
    ) then
      raise exception 'Contact does not belong to the viewing organization' using errcode = '23503';
    end if;
  else
    if nullif(trim(p_full_name), '') is null then
      raise exception 'Guest name is required' using errcode = '22023';
    end if;

    select contact.id
    into v_contact_id
    from public.contacts contact
    where contact.organization_id = v_organization_id
      and (
        (nullif(trim(p_email::text), '') is not null and contact.email = nullif(trim(p_email::text), '')::extensions.citext)
        or (
          nullif(trim(p_email::text), '') is null
          and nullif(trim(p_phone), '') is not null
          and contact.phone = nullif(trim(p_phone), '')
        )
      )
    order by contact.created_at
    limit 1;

    if v_contact_id is null then
      insert into public.contacts (
        organization_id, full_name, phone, email, created_by
      ) values (
        v_organization_id,
        trim(p_full_name),
        nullif(trim(p_phone), ''),
        nullif(trim(p_email::text), '')::extensions.citext,
        v_user_id
      ) returning id into v_contact_id;
    end if;
  end if;

  insert into public.viewing_guests (
    organization_id, viewing_id, contact_id, attendance, interest,
    internal_notes, next_action, follow_up_due_at, is_walk_in, created_by
  ) values (
    v_organization_id,
    p_viewing_id,
    v_contact_id,
    p_attendance,
    p_interest,
    coalesce(p_internal_notes, ''),
    nullif(trim(p_next_action), ''),
    p_follow_up_due_at,
    p_is_walk_in,
    v_user_id
  ) returning id into v_guest_id;

  return query select v_guest_id, v_contact_id;
end;
$$;

create function public.update_viewing_guest(
  p_viewing_guest_id uuid,
  p_attendance public.attendance_status,
  p_interest public.interest_level,
  p_internal_notes text,
  p_next_action text,
  p_follow_up_due_at timestamptz default null
)
returns public.viewing_guests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transaction_id uuid;
  v_guest public.viewing_guests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select viewing.transaction_id
  into v_transaction_id
  from public.viewing_guests guest
  join public.viewings viewing on viewing.id = guest.viewing_id
  where guest.id = p_viewing_guest_id;

  if not found then
    raise exception 'Viewing guest not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_transaction(v_transaction_id, v_user_id) then
    raise exception 'Not authorized to manage this viewing guest' using errcode = '42501';
  end if;

  update public.viewing_guests
  set attendance = p_attendance,
      interest = p_interest,
      internal_notes = coalesce(p_internal_notes, ''),
      next_action = nullif(trim(p_next_action), ''),
      follow_up_due_at = p_follow_up_due_at
  where id = p_viewing_guest_id
  returning * into v_guest;

  return v_guest;
end;
$$;

create function public.complete_viewing(
  p_viewing_id uuid,
  p_seller_safe_summary text default null
)
returns public.viewings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_viewing public.viewings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_viewing
  from public.viewings viewing
  where viewing.id = p_viewing_id
  for update;

  if not found then
    raise exception 'Viewing not found' using errcode = 'P0002';
  end if;
  if not private.can_manage_transaction(v_viewing.transaction_id, v_user_id) then
    raise exception 'Not authorized to complete this viewing' using errcode = '42501';
  end if;
  if v_viewing.status = 'cancelled' then
    raise exception 'A cancelled viewing cannot be completed' using errcode = '23514';
  end if;
  if v_viewing.status = 'completed' then
    return v_viewing;
  end if;

  update public.viewings
  set status = 'completed', completed_at = now()
  where id = p_viewing_id
  returning * into v_viewing;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_viewing.organization_id,
    v_viewing.transaction_id,
    v_user_id,
    'viewing_completed',
    'internal',
    'Viewing completed',
    jsonb_build_object(
      'viewing_id', v_viewing.id,
      'seller_safe_summary', nullif(trim(p_seller_safe_summary), '')
    )
  );

  return v_viewing;
end;
$$;

revoke all on function public.create_viewing(uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.create_viewing(uuid, text, timestamptz, timestamptz) to authenticated;

revoke all on function public.register_viewing_guest(
  uuid, uuid, text, text, extensions.citext, public.attendance_status,
  public.interest_level, text, text, timestamptz, boolean
) from public, anon;
grant execute on function public.register_viewing_guest(
  uuid, uuid, text, text, extensions.citext, public.attendance_status,
  public.interest_level, text, text, timestamptz, boolean
) to authenticated;

revoke all on function public.update_viewing_guest(
  uuid, public.attendance_status, public.interest_level, text, text, timestamptz
) from public, anon;
grant execute on function public.update_viewing_guest(
  uuid, public.attendance_status, public.interest_level, text, text, timestamptz
) to authenticated;

revoke all on function public.complete_viewing(uuid, text) from public, anon;
grant execute on function public.complete_viewing(uuid, text) to authenticated;

comment on column public.viewing_guests.internal_notes is
  'Internal CRM data. Never expose through customer-safe seller or buyer projections.';
