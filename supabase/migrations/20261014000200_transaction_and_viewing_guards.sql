-- Kelvo F-08/F-14: explicit forward-only transaction lifecycle and guarded
-- viewing state machine. Terminal transactions are immutable historical records.

create function private.assert_transaction_mutable(p_transaction_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stage public.transaction_stage;
begin
  select transaction.stage into v_stage
  from public.transactions transaction
  where transaction.id = p_transaction_id
  for update;

  if not found then
    raise exception 'Viðskipti fundust ekki' using errcode = 'P0002';
  end if;
  if v_stage in ('completed', 'cancelled') then
    raise exception 'Loknum eða niðurfelldum viðskiptum má ekki breyta'
      using errcode = '23514';
  end if;
end;
$$;

create function private.property_has_mutable_transaction(
  p_property_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.transactions transaction
    where transaction.property_id = p_property_id
      and transaction.organization_id = p_organization_id
      and transaction.stage not in ('completed', 'cancelled')
  );
$$;

revoke all on function private.assert_transaction_mutable(uuid)
  from public, anon, authenticated;
revoke all on function private.property_has_mutable_transaction(uuid,uuid)
  from public, anon, authenticated;

create function private.enforce_transaction_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.stage in ('completed', 'cancelled') then
      raise exception 'Loknum eða niðurfelldum viðskiptum má ekki eyða'
        using errcode = '23514';
    end if;
    return old;
  end if;

  if old.stage in ('completed', 'cancelled') then
    raise exception 'Loknum eða niðurfelldum viðskiptum má ekki breyta'
      using errcode = '23514';
  end if;
  if new.stage is not distinct from old.stage then
    return new;
  end if;

  -- Cancellation remains an intentional terminal operation. All other allowed
  -- changes move forward. listed/viewings/offers -> contract is reserved for
  -- the guarded accepted-offer handoff.
  v_allowed := new.stage = 'cancelled' or case old.stage
    when 'valuation' then new.stage = 'preparation'
    when 'preparation' then new.stage = 'listed'
    when 'listed' then new.stage in ('viewings', 'contract')
    when 'viewings' then new.stage in ('offers', 'contract')
    when 'offers' then new.stage = 'contract'
    when 'contract' then new.stage = 'closing'
    when 'closing' then new.stage = 'handover'
    when 'handover' then new.stage = 'completed'
    else false
  end;

  if not v_allowed then
    raise exception 'Óstudd breyting á stöðu viðskipta'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_enforce_lifecycle
before update or delete on public.transactions
for each row execute function private.enforce_transaction_lifecycle();

revoke all on function private.enforce_transaction_lifecycle()
  from public, anon, authenticated;

-- Direct transaction children share one terminal-state boundary. Checking both
-- old and new transaction IDs also protects against row reassignment.
create function private.prevent_terminal_transaction_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_transaction_id uuid;
  v_new_transaction_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_transaction_id := nullif(to_jsonb(old)->>'transaction_id', '')::uuid;
    perform private.assert_transaction_mutable(v_old_transaction_id);
  end if;
  if tg_op <> 'DELETE' then
    v_new_transaction_id := nullif(to_jsonb(new)->>'transaction_id', '')::uuid;
    if v_new_transaction_id is distinct from v_old_transaction_id then
      perform private.assert_transaction_mutable(v_new_transaction_id);
    elsif tg_op = 'INSERT' then
      perform private.assert_transaction_mutable(v_new_transaction_id);
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger tasks_prevent_terminal_mutation
before insert or update or delete on public.tasks
for each row execute function private.prevent_terminal_transaction_child_mutation();
create trigger documents_prevent_terminal_mutation
before insert or update or delete on public.documents
for each row execute function private.prevent_terminal_transaction_child_mutation();
create trigger offers_prevent_terminal_mutation
before insert or update or delete on public.offers
for each row execute function private.prevent_terminal_transaction_child_mutation();
create trigger viewings_prevent_terminal_mutation
before insert or update or delete on public.viewings
for each row execute function private.prevent_terminal_transaction_child_mutation();
create trigger seller_listing_responses_prevent_terminal_mutation
before insert or update or delete on public.seller_listing_responses
for each row execute function private.prevent_terminal_transaction_child_mutation();
create trigger transaction_parties_prevent_terminal_mutation
before insert or update or delete on public.transaction_parties
for each row execute function private.prevent_terminal_transaction_child_mutation();
create trigger transaction_assignments_prevent_terminal_mutation
before insert or update or delete on public.transaction_assignments
for each row execute function private.prevent_terminal_transaction_child_mutation();

revoke all on function private.prevent_terminal_transaction_child_mutation()
  from public, anon, authenticated;

create function private.prevent_terminal_offer_child_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_offer_id uuid;
  v_new_offer_id uuid;
  v_transaction_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_offer_id := nullif(to_jsonb(old)->>'offer_id', '')::uuid;
    select offer.transaction_id into v_transaction_id
    from public.offers offer where offer.id = v_old_offer_id;
    if not found then raise exception 'Tilboð fannst ekki' using errcode = 'P0002'; end if;
    perform private.assert_transaction_mutable(v_transaction_id);
  end if;
  if tg_op <> 'DELETE' then
    v_new_offer_id := nullif(to_jsonb(new)->>'offer_id', '')::uuid;
    if tg_op = 'INSERT' or v_new_offer_id is distinct from v_old_offer_id then
      select offer.transaction_id into v_transaction_id
      from public.offers offer where offer.id = v_new_offer_id;
      if not found then raise exception 'Tilboð fannst ekki' using errcode = 'P0002'; end if;
      perform private.assert_transaction_mutable(v_transaction_id);
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger offer_conditions_prevent_terminal_mutation
before insert or update or delete on public.offer_conditions
for each row execute function private.prevent_terminal_offer_child_mutation();
create trigger offer_reviews_prevent_terminal_mutation
before insert or update or delete on public.offer_reviews
for each row execute function private.prevent_terminal_offer_child_mutation();
create trigger seller_offer_responses_prevent_terminal_mutation
before insert or update or delete on public.seller_offer_responses
for each row execute function private.prevent_terminal_offer_child_mutation();

revoke all on function private.prevent_terminal_offer_child_mutation()
  from public, anon, authenticated;

create function private.prevent_closed_viewing_guest_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_viewing_id uuid;
  v_new_viewing_id uuid;
  v_status public.viewing_status;
  v_transaction_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_viewing_id := nullif(to_jsonb(old)->>'viewing_id', '')::uuid;
    select viewing.status, viewing.transaction_id into v_status, v_transaction_id
    from public.viewings viewing where viewing.id = v_old_viewing_id for update;
    if not found then raise exception 'Skoðun fannst ekki' using errcode = 'P0002'; end if;
    perform private.assert_transaction_mutable(v_transaction_id);
    if v_status in ('completed', 'cancelled') then
      raise exception 'Lokinni eða niðurfelldri skoðun má ekki breyta'
        using errcode = '23514';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    v_new_viewing_id := nullif(to_jsonb(new)->>'viewing_id', '')::uuid;
    if tg_op = 'INSERT' or v_new_viewing_id is distinct from v_old_viewing_id then
      select viewing.status, viewing.transaction_id into v_status, v_transaction_id
      from public.viewings viewing where viewing.id = v_new_viewing_id for update;
      if not found then raise exception 'Skoðun fannst ekki' using errcode = 'P0002'; end if;
      perform private.assert_transaction_mutable(v_transaction_id);
      if v_status in ('completed', 'cancelled') then
        raise exception 'Lokinni eða niðurfelldri skoðun má ekki breyta'
          using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger viewing_guests_prevent_closed_mutation
before insert or update or delete on public.viewing_guests
for each row execute function private.prevent_closed_viewing_guest_mutation();

revoke all on function private.prevent_closed_viewing_guest_mutation()
  from public, anon, authenticated;

create function private.prevent_terminal_property_image_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_image jsonb;
  v_new_image jsonb;
begin
  if tg_op <> 'INSERT' then
    v_old_image := to_jsonb(old);
    perform 1 from public.transactions transaction
    where transaction.property_id = (v_old_image->>'property_id')::uuid
      and transaction.organization_id = (v_old_image->>'organization_id')::uuid
      and transaction.stage not in ('completed', 'cancelled') for update;
    if not found then
      raise exception 'Myndum lokaðrar eignarfærslu má ekki breyta' using errcode = '23514';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    v_new_image := to_jsonb(new);
    if tg_op = 'INSERT'
      or (v_new_image->>'property_id') is distinct from (v_old_image->>'property_id')
      or (v_new_image->>'organization_id') is distinct from (v_old_image->>'organization_id') then
      perform 1 from public.transactions transaction
      where transaction.property_id = (v_new_image->>'property_id')::uuid
        and transaction.organization_id = (v_new_image->>'organization_id')::uuid
        and transaction.stage not in ('completed', 'cancelled') for update;
      if not found then
        raise exception 'Myndum lokaðrar eignarfærslu má ekki breyta' using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger property_images_prevent_terminal_mutation
before insert or update or delete on public.property_images
for each row execute function private.prevent_terminal_property_image_mutation();

revoke all on function private.prevent_terminal_property_image_mutation()
  from public, anon, authenticated;

-- Storage must reject destructive writes before application metadata RPCs run.
drop policy if exists property_images_storage_insert on storage.objects;
create policy property_images_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'property-images'
  and private.can_operate_organization((storage.foldername(name))[2]::uuid)
  and exists (
    select 1 from public.properties property
    where property.organization_id = (storage.foldername(name))[2]::uuid
      and property.id = (storage.foldername(name))[4]::uuid
      and private.property_has_mutable_transaction(property.id, property.organization_id)
  )
);

drop policy if exists property_images_storage_delete on storage.objects;
create policy property_images_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'property-images'
  and (
    exists (
      select 1 from public.property_images image
      where image.storage_path = name
        and private.can_operate_organization(image.organization_id)
        and private.property_has_mutable_transaction(image.property_id, image.organization_id)
    )
    or (
      (storage.foldername(name))[1] = 'organizations'
      and (storage.foldername(name))[3] = 'properties'
      and private.can_operate_organization((storage.foldername(name))[2]::uuid)
      and exists (
        select 1 from public.properties property
        where property.organization_id = (storage.foldername(name))[2]::uuid
          and property.id = (storage.foldername(name))[4]::uuid
          and private.property_has_mutable_transaction(property.id, property.organization_id)
      )
    )
  )
);

drop policy if exists transaction_documents_internal_delete on storage.objects;
create policy transaction_documents_internal_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'transaction-documents'
  and exists (
    select 1 from public.documents document
    where document.storage_path = name
      and private.can_manage_transaction(document.transaction_id)
      and exists (
        select 1 from public.transactions transaction
        where transaction.id = document.transaction_id
          and transaction.stage not in ('completed', 'cancelled')
      )
  )
);

drop policy if exists transaction_documents_internal_update on storage.objects;
create policy transaction_documents_internal_update on storage.objects
for update to authenticated using (
  bucket_id = 'transaction-documents'
  and exists (
    select 1 from public.documents document
    join public.transactions transaction on transaction.id = document.transaction_id
    where document.storage_path = name
      and private.can_manage_transaction(document.transaction_id)
      and transaction.stage not in ('completed', 'cancelled')
  )
) with check (
  bucket_id = 'transaction-documents'
  and exists (
    select 1 from public.documents document
    join public.transactions transaction on transaction.id = document.transaction_id
    where document.storage_path = name
      and private.can_manage_transaction(document.transaction_id)
      and transaction.stage not in ('completed', 'cancelled')
  )
);

create or replace function public.advance_transaction_stage(
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
  v_stage_label text;
begin
  if v_user_id is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_transaction from public.transactions transaction
  where transaction.id = p_transaction_id for update;
  if not found then raise exception 'Viðskipti fundust ekki' using errcode = 'P0002'; end if;

  if not private.has_org_role(
    v_transaction.organization_id,
    array['admin', 'coordinator']::public.organization_role[], v_user_id
  ) and not exists (
    select 1 from public.transaction_assignments assignment
    join public.organization_memberships membership
      on membership.organization_id = assignment.organization_id
     and membership.user_id = assignment.user_id and membership.is_active
    where assignment.transaction_id = p_transaction_id
      and assignment.user_id = v_user_id
  ) then
    raise exception 'Þú hefur ekki heimild til að breyta stöðu viðskiptanna'
      using errcode = '42501';
  end if;

  if v_transaction.stage in ('completed', 'cancelled') then
    raise exception 'Loknum eða niðurfelldum viðskiptum má ekki breyta'
      using errcode = '23514';
  end if;

  if (v_transaction.stage = 'offers' and p_next_stage = 'contract')
    or (v_transaction.stage = 'contract' and p_next_stage = 'closing')
    or (v_transaction.stage = 'closing' and p_next_stage = 'handover')
    or (v_transaction.stage = 'handover' and p_next_stage = 'completed') then
    raise exception 'Þessi stöðubreyting krefst sérstaks staðfestingarferlis'
      using errcode = '23514';
  end if;

  v_allowed := p_next_stage = 'cancelled' or case v_transaction.stage
    when 'valuation' then p_next_stage = 'preparation'
    when 'preparation' then p_next_stage = 'listed'
    when 'listed' then p_next_stage = 'viewings'
    when 'viewings' then p_next_stage = 'offers'
    else false
  end;
  if not v_allowed then
    raise exception 'Ekki er heimilt að færa viðskiptin aftur á fyrra stig'
      using errcode = '23514';
  end if;

  v_from_stage := v_transaction.stage;
  update public.transactions
  set stage = p_next_stage
  where id = p_transaction_id
  returning * into v_transaction;

  v_stage_label := case p_next_stage
    when 'preparation' then 'Undirbúningur'
    when 'listed' then 'Á sölu'
    when 'viewings' then 'Skoðanir'
    when 'offers' then 'Tilboð'
    when 'cancelled' then 'Hætt við'
    else p_next_stage::text
  end;
  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason
  ) values (
    v_transaction.organization_id, p_transaction_id, v_from_stage,
    p_next_stage, v_user_id, nullif(trim(p_reason), '')
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_user_id,
    'transaction_stage_advanced', 'internal',
    format('Staða viðskipta uppfærð: %s', v_stage_label),
    jsonb_build_object('from_stage', v_from_stage, 'to_stage', p_next_stage, 'reason', nullif(trim(p_reason), ''))
  );
  return v_transaction;
end;
$$;

revoke all on function public.advance_transaction_stage(uuid,public.transaction_stage,text)
  from public, anon;
grant execute on function public.advance_transaction_stage(uuid,public.transaction_stage,text)
  to authenticated;

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
  v_transaction public.transactions%rowtype;
  v_viewing public.viewings%rowtype;
begin
  if v_user_id is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_transaction from public.transactions
  where id = p_transaction_id for update;
  if not found then raise exception 'Viðskipti fundust ekki' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(p_transaction_id, v_user_id) then
    raise exception 'Þú hefur ekki heimild til að skrá skoðun' using errcode = '42501';
  end if;
  perform private.assert_transaction_mutable(p_transaction_id);
  if v_transaction.stage not in ('listed', 'viewings', 'offers') then
    raise exception 'Ekki er hægt að skrá skoðun á þessu stigi viðskipta'
      using errcode = '23514';
  end if;
  if nullif(trim(p_viewing_type), '') is null or p_ends_at <= p_starts_at then
    raise exception 'Tegund skoðunar og gilt tímabil eru nauðsynleg'
      using errcode = '22023';
  end if;
  if p_ends_at <= clock_timestamp() then
    raise exception 'Ekki er hægt að stofna skoðun sem er þegar liðin'
      using errcode = '23514';
  end if;

  insert into public.viewings (
    organization_id, transaction_id, viewing_type, starts_at, ends_at, status, created_by
  ) values (
    v_transaction.organization_id, p_transaction_id, trim(p_viewing_type),
    p_starts_at, p_ends_at, 'scheduled', v_user_id
  ) returning * into v_viewing;
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_user_id,
    'viewing_created', 'internal', 'Skoðun stofnuð',
    jsonb_build_object('viewing_id', v_viewing.id, 'starts_at', p_starts_at)
  );
  return v_viewing;
end;
$$;

create or replace function public.register_viewing_guest(
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
  v_viewing public.viewings%rowtype;
  v_contact_id uuid := p_contact_id;
  v_guest_id uuid;
begin
  if v_user_id is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_viewing from public.viewings where id = p_viewing_id for update;
  if not found then raise exception 'Skoðun fannst ekki' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(v_viewing.transaction_id, v_user_id) then
    raise exception 'Þú hefur ekki heimild til að skrá gest' using errcode = '42501';
  end if;
  perform private.assert_transaction_mutable(v_viewing.transaction_id);
  if v_viewing.status not in ('scheduled', 'active') then
    raise exception 'Ekki er hægt að breyta gestum lokaðrar skoðunar'
      using errcode = '23514';
  end if;

  if v_contact_id is not null then
    if not exists (
      select 1 from public.contacts contact
      where contact.id = v_contact_id
        and contact.organization_id = v_viewing.organization_id
    ) then
      raise exception 'Tengiliður tilheyrir ekki fyrirtæki skoðunarinnar'
        using errcode = '23503';
    end if;
  else
    if nullif(trim(p_full_name), '') is null then
      raise exception 'Nafn gests er nauðsynlegt' using errcode = '22023';
    end if;
    select contact.id into v_contact_id
    from public.contacts contact
    where contact.organization_id = v_viewing.organization_id
      and (
        (nullif(trim(p_email::text), '') is not null
          and contact.email = nullif(trim(p_email::text), '')::extensions.citext)
        or (
          nullif(trim(p_email::text), '') is null
          and nullif(trim(p_phone), '') is not null
          and contact.phone = nullif(trim(p_phone), '')
        )
      )
    order by contact.created_at limit 1;
    if v_contact_id is null then
      insert into public.contacts (organization_id, full_name, phone, email, created_by)
      values (
        v_viewing.organization_id, trim(p_full_name), nullif(trim(p_phone), ''),
        nullif(trim(p_email::text), '')::extensions.citext, v_user_id
      ) returning id into v_contact_id;
    end if;
  end if;

  insert into public.viewing_guests (
    organization_id, viewing_id, contact_id, attendance, interest,
    internal_notes, next_action, follow_up_due_at, is_walk_in, created_by
  ) values (
    v_viewing.organization_id, p_viewing_id, v_contact_id, p_attendance, p_interest,
    coalesce(p_internal_notes, ''), nullif(trim(p_next_action), ''),
    p_follow_up_due_at, p_is_walk_in, v_user_id
  ) returning id into v_guest_id;
  return query select v_guest_id, v_contact_id;
end;
$$;

create or replace function public.update_viewing_guest(
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
  v_guest public.viewing_guests%rowtype;
  v_viewing public.viewings%rowtype;
begin
  if v_user_id is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_guest from public.viewing_guests
  where id = p_viewing_guest_id for update;
  if not found then raise exception 'Gestur fannst ekki' using errcode = 'P0002'; end if;
  select * into v_viewing from public.viewings where id = v_guest.viewing_id for update;
  if not private.can_manage_transaction(v_viewing.transaction_id, v_user_id) then
    raise exception 'Þú hefur ekki heimild til að breyta gesti' using errcode = '42501';
  end if;
  perform private.assert_transaction_mutable(v_viewing.transaction_id);
  if v_viewing.status not in ('scheduled', 'active') then
    raise exception 'Ekki er hægt að breyta gestum lokaðrar skoðunar'
      using errcode = '23514';
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

create or replace function public.complete_viewing(
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
  if v_user_id is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_viewing from public.viewings where id = p_viewing_id for update;
  if not found then raise exception 'Skoðun fannst ekki' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(v_viewing.transaction_id, v_user_id) then
    raise exception 'Þú hefur ekki heimild til að ljúka skoðun' using errcode = '42501';
  end if;
  perform private.assert_transaction_mutable(v_viewing.transaction_id);
  if v_viewing.status = 'cancelled' then
    raise exception 'Ekki er hægt að ljúka niðurfelldri skoðun'
      using errcode = '23514';
  end if;
  if v_viewing.status = 'completed' then
    raise exception 'Skoðuninni hefur þegar verið lokið'
      using errcode = '23514';
  end if;
  if clock_timestamp() < v_viewing.ends_at then
    raise exception 'Ekki er hægt að ljúka skoðun áður en henni lýkur'
      using errcode = '23514';
  end if;

  update public.viewings set status = 'completed', completed_at = clock_timestamp()
  where id = p_viewing_id returning * into v_viewing;
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata
  ) values (
    v_viewing.organization_id, v_viewing.transaction_id, v_user_id,
    'viewing_completed', 'internal', 'Skoðun lokið',
    jsonb_build_object(
      'viewing_id', v_viewing.id,
      'seller_safe_summary', nullif(trim(p_seller_safe_summary), '')
    )
  );
  return v_viewing;
end;
$$;

create function public.cancel_viewing(
  p_viewing_id uuid,
  p_reason text default null
)
returns public.viewings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_viewing public.viewings%rowtype;
  v_reason text := nullif(trim(p_reason), '');
begin
  if v_user_id is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_viewing from public.viewings where id = p_viewing_id for update;
  if not found then raise exception 'Skoðun fannst ekki' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(v_viewing.transaction_id, v_user_id) then
    raise exception 'Þú hefur ekki heimild til að fella niður skoðun'
      using errcode = '42501';
  end if;
  perform private.assert_transaction_mutable(v_viewing.transaction_id);
  if v_viewing.status = 'completed' then
    raise exception 'Ekki er hægt að fella niður lokna skoðun'
      using errcode = '23514';
  end if;
  if v_viewing.status = 'cancelled' then return v_viewing; end if;

  update public.viewings set status = 'cancelled', completed_at = null
  where id = p_viewing_id returning * into v_viewing;
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata
  ) values (
    v_viewing.organization_id, v_viewing.transaction_id, v_user_id,
    'viewing_cancelled', 'internal', 'Skoðun felld niður',
    jsonb_build_object('viewing_id', v_viewing.id, 'reason', v_reason)
  );
  return v_viewing;
end;
$$;

revoke all on function public.create_viewing(uuid,text,timestamptz,timestamptz)
  from public, anon;
revoke all on function public.register_viewing_guest(
  uuid,uuid,text,text,extensions.citext,public.attendance_status,
  public.interest_level,text,text,timestamptz,boolean
) from public, anon;
revoke all on function public.update_viewing_guest(
  uuid,public.attendance_status,public.interest_level,text,text,timestamptz
) from public, anon;
revoke all on function public.complete_viewing(uuid,text) from public, anon;
revoke all on function public.cancel_viewing(uuid,text) from public, anon;

grant execute on function public.create_viewing(uuid,text,timestamptz,timestamptz)
  to authenticated;
grant execute on function public.register_viewing_guest(
  uuid,uuid,text,text,extensions.citext,public.attendance_status,
  public.interest_level,text,text,timestamptz,boolean
) to authenticated;
grant execute on function public.update_viewing_guest(
  uuid,public.attendance_status,public.interest_level,text,text,timestamptz
) to authenticated;
grant execute on function public.complete_viewing(uuid,text) to authenticated;
grant execute on function public.cancel_viewing(uuid,text) to authenticated;

comment on function public.cancel_viewing(uuid,text) is
  'Authorized, idempotent cancellation for scheduled/active viewings; preserves guests and appends activity.';
