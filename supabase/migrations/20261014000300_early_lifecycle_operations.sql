-- F-01: make the early transaction lifecycle operable through dedicated,
-- guarded and auditable transitions. The generic stage setter is deliberately
-- no longer a path through valuation, preparation, listing, viewings or offers.

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
begin
  if v_user_id is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_transaction
  from public.transactions transaction
  where transaction.id = p_transaction_id
  for update;
  if not found then raise exception 'Viðskipti fundust ekki' using errcode = 'P0002'; end if;

  if not private.can_manage_transaction(p_transaction_id, v_user_id) then
    raise exception 'Þú hefur ekki heimild til að breyta stöðu viðskiptanna'
      using errcode = '42501';
  end if;
  if v_transaction.stage in ('completed', 'cancelled') then
    raise exception 'Loknum eða niðurfelldum viðskiptum má ekki breyta'
      using errcode = '23514';
  end if;
  if p_next_stage <> 'cancelled' then
    raise exception 'Þessi stöðubreyting krefst sérstaks vinnuferlis í Kelvo'
      using errcode = '23514';
  end if;

  v_from_stage := v_transaction.stage;
  update public.transactions
  set stage = 'cancelled'
  where id = p_transaction_id
  returning * into v_transaction;

  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason
  ) values (
    v_transaction.organization_id, p_transaction_id, v_from_stage,
    'cancelled', v_user_id, nullif(trim(p_reason), '')
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_user_id,
    'transaction_cancelled', 'internal', 'Viðskipti felld niður',
    jsonb_build_object('reason', nullif(trim(p_reason), ''))
  );
  return v_transaction;
end;
$$;

revoke all on function public.advance_transaction_stage(uuid,public.transaction_stage,text)
  from public, anon;
grant execute on function public.advance_transaction_stage(uuid,public.transaction_stage,text)
  to authenticated;

create or replace function public.start_listing_preparation(p_transaction_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
begin
  if v_actor is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception 'Viðskipti fundust ekki' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Þú hefur ekki heimild til að hefja undirbúning'
      using errcode = '42501';
  end if;
  if v_transaction.stage in ('completed', 'cancelled') then
    raise exception 'Loknum eða niðurfelldum viðskiptum má ekki breyta'
      using errcode = '23514';
  end if;
  if v_transaction.stage = 'preparation' then return v_transaction; end if;
  if v_transaction.stage <> 'valuation' then
    raise exception 'Aðeins er hægt að hefja undirbúning úr Verðmati'
      using errcode = '23514';
  end if;

  update public.transactions
  set stage = 'preparation'
  where id = p_transaction_id
  returning * into v_transaction;
  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason
  ) values (
    v_transaction.organization_id, p_transaction_id, 'valuation',
    'preparation', v_actor, 'Undirbúningur skráningar hafinn'
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'listing_preparation_started', 'internal',
    'Undirbúningur skráningar hafinn',
    jsonb_build_object('from_stage', 'valuation', 'to_stage', 'preparation')
  );
  return v_transaction;
end;
$$;

revoke all on function public.start_listing_preparation(uuid) from public, anon;
grant execute on function public.start_listing_preparation(uuid) to authenticated;

create or replace function public.activate_property_listing(p_transaction_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
begin
  if v_actor is null then raise exception 'Innskráningar er krafist' using errcode = '28000'; end if;
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception 'Viðskipti fundust ekki' using errcode = 'P0002'; end if;
  if not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Þú hefur ekki heimild til að setja eignina á sölu'
      using errcode = '42501';
  end if;
  if v_transaction.stage in ('completed', 'cancelled') then
    raise exception 'Loknum eða niðurfelldum viðskiptum má ekki breyta'
      using errcode = '23514';
  end if;
  if v_transaction.stage = 'listed' then return v_transaction; end if;
  if v_transaction.stage <> 'preparation' then
    raise exception 'Aðeins er hægt að setja eign á sölu úr Undirbúningi'
      using errcode = '23514';
  end if;
  if v_transaction.ready_for_publish_at is null
    or not private.listing_publish_requirements_met(p_transaction_id) then
    raise exception 'Skráningin uppfyllir ekki öll skilyrði fyrir sölu'
      using errcode = '23514';
  end if;

  update public.transactions
  set stage = 'listed'
  where id = p_transaction_id
  returning * into v_transaction;
  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason
  ) values (
    v_transaction.organization_id, p_transaction_id, 'preparation',
    'listed', v_actor, 'Eign sett á sölu í Kelvo'
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'property_listed', 'internal', 'Eign sett á sölu',
    jsonb_build_object(
      'from_stage', 'preparation', 'to_stage', 'listed',
      'external_publication', false
    )
  );
  return v_transaction;
end;
$$;

revoke all on function public.activate_property_listing(uuid) from public, anon;
grant execute on function public.activate_property_listing(uuid) to authenticated;

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

  if v_transaction.stage = 'listed' then
    update public.transactions set stage = 'viewings' where id = p_transaction_id;
    insert into public.transaction_stage_history (
      organization_id, transaction_id, from_stage, to_stage, changed_by, reason
    ) values (
      v_transaction.organization_id, p_transaction_id, 'listed', 'viewings',
      v_user_id, 'Fyrsta skoðun skráð'
    );
    insert into public.activity_events (
      organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata
    ) values (
      v_transaction.organization_id, p_transaction_id, v_user_id,
      'transaction_stage_advanced', 'internal',
      'Viðskipti færð í Skoðanir',
      jsonb_build_object('from_stage', 'listed', 'to_stage', 'viewings', 'viewing_id', v_viewing.id)
    );
  end if;
  return v_viewing;
end;
$$;

revoke all on function public.create_viewing(uuid,text,timestamptz,timestamptz)
  from public, anon;
grant execute on function public.create_viewing(uuid,text,timestamptz,timestamptz)
  to authenticated;

create or replace function public.submit_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_transaction public.transactions%rowtype;
  v_from public.offer_status;
  v_internal_actor uuid;
  v_history_actor uuid;
  v_contact_id uuid;
begin
  if v_user_id is null then
    raise exception 'Innskráningar er krafist' using errcode = '28000';
  end if;
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if not found then raise exception 'Tilboð fannst ekki' using errcode = 'P0002'; end if;
  select * into v_transaction
  from public.transactions
  where id = v_offer.transaction_id
  for update;
  if not found then raise exception 'Viðskipti fundust ekki' using errcode = 'P0002'; end if;

  v_contact_id := private.portal_contact_id(
    v_offer.transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if private.can_manage_offer(p_offer_id, v_user_id) then
    v_internal_actor := v_user_id;
  elsif v_contact_id is null or v_contact_id is distinct from v_offer.buyer_contact_id then
    raise exception 'Þú hefur ekki heimild til að senda þetta tilboð'
      using errcode = '42501';
  end if;
  perform private.assert_transaction_mutable(v_offer.transaction_id);
  if v_transaction.stage not in ('viewings', 'offers') then
    raise exception 'Ekki er hægt að senda tilboð á þessu stigi viðskipta'
      using errcode = '23514';
  end if;
  if v_offer.status not in ('draft', 'change_requested') then
    raise exception 'Aðeins er hægt að senda drög eða tilboð sem þarfnast breytinga'
      using errcode = '23514';
  end if;

  v_from := v_offer.status;
  update public.offers
  set status = 'submitted',
      submitted_at = now(),
      buyer_user_id = coalesce(buyer_user_id, v_user_id)
  where id = p_offer_id
  returning * into v_offer;

  insert into public.offer_status_history (
    organization_id, offer_id, from_status, to_status, changed_by, reason
  ) values (
    v_offer.organization_id, p_offer_id, v_from, 'submitted', v_user_id,
    'Tilboð sent til yfirferðar hjá fasteignasala'
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_offer.organization_id, v_offer.transaction_id, v_internal_actor,
    'offer_submitted', 'buyer', 'Tilboð móttekið',
    jsonb_build_object(
      'offer_id', p_offer_id,
      'customer_user_id', case when v_internal_actor is null then v_user_id else null end
    )
  );

  if v_transaction.stage = 'viewings' then
    v_history_actor := coalesce(v_internal_actor, v_transaction.assigned_agent_id);
    if v_history_actor is null then
      raise exception 'Ábyrgur fasteignasali þarf að vera skráður áður en tilboð er sent'
        using errcode = '23514';
    end if;
    update public.transactions set stage = 'offers' where id = v_offer.transaction_id;
    insert into public.transaction_stage_history (
      organization_id, transaction_id, from_stage, to_stage, changed_by, reason
    ) values (
      v_offer.organization_id, v_offer.transaction_id, 'viewings', 'offers',
      v_history_actor, 'Fyrsta tilboð móttekið'
    );
    insert into public.activity_events (
      organization_id, transaction_id, actor_user_id, event_type,
      visibility, summary, metadata
    ) values (
      v_offer.organization_id, v_offer.transaction_id, v_internal_actor,
      'transaction_stage_advanced', 'internal',
      'Viðskipti færð í Tilboð',
      jsonb_build_object('from_stage', 'viewings', 'to_stage', 'offers', 'offer_id', p_offer_id)
    );
  end if;
  return v_offer;
end;
$$;

revoke all on function public.submit_offer(uuid) from public, anon;
grant execute on function public.submit_offer(uuid) to authenticated;
