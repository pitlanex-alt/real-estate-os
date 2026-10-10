-- Kelvo corrective workflow migration.
-- Adds the buyer-safe transaction stage and localizes future workflow activity.

create or replace function public.buyer_property_summary(p_transaction_id uuid)
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
  v_contact_id := private.portal_contact_id(
    p_transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if v_contact_id is null then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'transaction_id', transaction.id,
    'stage', transaction.stage,
    'asking_price_isk', transaction.asking_price_isk,
    'property', jsonb_build_object(
      'address', property.address_line,
      'postal_code', property.postal_code,
      'municipality', property.municipality,
      'size_sqm', property.size_sqm,
      'bedroom_count', property.bedroom_count,
      'year_built', property.year_built
    ),
    'agent', jsonb_build_object(
      'name', agent.display_name,
      'phone', agent.phone
    ),
    'customer', jsonb_build_object(
      'name', contact.full_name,
      'phone', contact.phone,
      'email', contact.email
    )
  ) into v_result
  from public.transactions transaction
  join public.properties property on property.id = transaction.property_id
  join public.profiles agent on agent.id = transaction.assigned_agent_id
  join public.contacts contact on contact.id = v_contact_id
  where transaction.id = p_transaction_id;

  return v_result;
end;
$$;

revoke all on function public.buyer_property_summary(uuid) from public, anon;
grant execute on function public.buyer_property_summary(uuid) to authenticated;

create or replace function private.invalidate_listing_publish_readiness(
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
      'Skráning þarf nýja yfirferð',
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
    'Skráningarupplýsingar uppfærðar',
    jsonb_build_object('readiness', v_state)
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

  if p_response_type = 'changes_requested'
    and v_transaction.ready_for_publish_at is not null then
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
      then 'Seljandi samþykkti skráningu'
      else 'Seljandi óskaði eftir breytingu á skráningu'
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

revoke all on function public.record_seller_listing_response(
  uuid,public.listing_seller_response_type,text
) from public, anon;
grant execute on function public.record_seller_listing_response(
  uuid,public.listing_seller_response_type,text
) to authenticated;

create or replace function public.mark_listing_ready_for_publish(p_transaction_id uuid)
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
    'Eign tilbúin til birtingar',
    jsonb_build_object('listing_revision', v_transaction.listing_revision)
  );

  return jsonb_build_object(
    'state', 'ready_to_publish',
    'ready_for_publish_at', (
      select ready_for_publish_at
      from public.transactions
      where id = p_transaction_id
    ),
    'ready_for_publish_by', v_actor
  );
end;
$$;

revoke all on function public.mark_listing_ready_for_publish(uuid) from public, anon;
grant execute on function public.mark_listing_ready_for_publish(uuid) to authenticated;

create or replace function public.confirm_offer_outcome(
  p_offer_id uuid,
  p_outcome public.offer_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_transaction public.transactions%rowtype;
  v_latest_intent public.seller_intent;
  v_competing public.offers%rowtype;
  v_reason text := nullif(trim(p_reason), '');
  v_previous_stage public.transaction_stage;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_outcome not in ('accepted', 'rejected') then
    raise exception 'Outcome must be accepted or rejected' using errcode = '22023';
  end if;

  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;

  select * into v_transaction
  from public.transactions
  where id = v_offer.transaction_id
  for update;
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_offer.organization_id
      and membership.user_id = v_actor
      and membership.is_active
      and membership.role in ('admin', 'agent', 'coordinator')
  ) or not private.can_manage_transaction(v_offer.transaction_id, v_actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_offer.status in ('accepted', 'rejected', 'withdrawn', 'expired', 'superseded') then
    raise exception 'Offer already has a terminal outcome' using errcode = '23514';
  end if;

  if p_outcome = 'accepted' then
    select response.intent into v_latest_intent
    from public.seller_offer_responses response
    where response.offer_id = p_offer_id
    order by response.submitted_at desc, response.id desc
    limit 1;
    if v_latest_intent is distinct from 'accept'::public.seller_intent then
      raise exception 'Latest seller intent is not acceptance' using errcode = '23514';
    end if;
    if v_offer.status <> 'seller_intent_recorded' then
      raise exception 'Offer is not ready for accepted handoff' using errcode = '23514';
    end if;
    if v_transaction.stage not in ('listed', 'viewings', 'offers', 'contract') then
      raise exception 'Transaction cannot move to contract from its current stage' using errcode = '23514';
    end if;

    update public.offers set status = 'accepted' where id = p_offer_id;
    perform private.append_offer_transition(
      p_offer_id, v_offer.status, 'accepted', v_actor, v_reason,
      'offer_accepted_internal', 'internal', 'Tilboð staðfest sem samþykkt'
    );

    for v_competing in
      select * from public.offers competing
      where competing.transaction_id = v_offer.transaction_id
        and competing.id <> p_offer_id
        and competing.status in (
          'submitted', 'change_requested', 'agent_approved',
          'sent_to_seller', 'seller_intent_recorded'
        )
      for update
    loop
      update public.offers set status = 'superseded' where id = v_competing.id;
      perform private.append_offer_transition(
        v_competing.id, v_competing.status, 'superseded', v_actor,
        'Annað tilboð var staðfest sem samþykkt',
        'offer_superseded_after_acceptance', 'internal',
        'Tilboð fellt úr gildi vegna samþykkts tilboðs'
      );
    end loop;

    if v_transaction.stage <> 'contract' then
      v_previous_stage := v_transaction.stage;
      update public.transactions set stage = 'contract'
      where id = v_transaction.id;
      insert into public.transaction_stage_history (
        organization_id, transaction_id, from_stage, to_stage, changed_by, reason
      ) values (
        v_transaction.organization_id, v_transaction.id,
        v_previous_stage, 'contract', v_actor,
        'Ábyrgur fasteignasali staðfesti samþykkt tilboðs'
      );
      insert into public.activity_events (
        organization_id, transaction_id, actor_user_id, event_type,
        visibility, summary, metadata
      ) values (
        v_transaction.organization_id, v_transaction.id, v_actor,
        'transaction_stage_advanced', 'internal',
        'Undirbúningur kaupsamnings hafinn',
        jsonb_build_object(
          'from_stage', v_previous_stage,
          'to_stage', 'contract',
          'accepted_offer_id', p_offer_id
        )
      );
    end if;
  else
    if v_offer.status not in (
      'submitted', 'change_requested', 'agent_approved',
      'sent_to_seller', 'seller_intent_recorded'
    ) then
      raise exception 'Offer is not available for rejection' using errcode = '23514';
    end if;
    update public.offers set status = 'rejected' where id = p_offer_id;
    perform private.append_offer_transition(
      p_offer_id, v_offer.status, 'rejected', v_actor, v_reason,
      'offer_rejected_internal', 'internal', 'Tilboði hafnað'
    );
  end if;

  return jsonb_build_object(
    'offer_id', p_offer_id,
    'status', p_outcome,
    'transaction_id', v_offer.transaction_id,
    'transaction_stage', case
      when p_outcome = 'accepted' then 'contract'
      else v_transaction.stage::text
    end
  );
end;
$$;

revoke all on function public.confirm_offer_outcome(uuid,public.offer_status,text)
  from public, anon;
grant execute on function public.confirm_offer_outcome(uuid,public.offer_status,text)
  to authenticated;

create or replace function private.ensure_contract_preparation_tasks(
  p_transaction_id uuid,
  p_actor uuid default auth.uid()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction public.transactions%rowtype;
  v_creator uuid;
  v_assignee uuid;
  v_inserted integer := 0;
begin
  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;
  if not found or v_transaction.stage <> 'contract' then return 0; end if;
  if not exists (
    select 1 from public.offers offer
    where offer.transaction_id = p_transaction_id
      and offer.status = 'accepted'
  ) then
    return 0;
  end if;

  if p_actor is not null and exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = p_actor
      and membership.is_active
  ) then
    v_creator := p_actor;
  elsif exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_transaction.assigned_agent_id
  ) then
    v_creator := v_transaction.assigned_agent_id;
  else
    v_creator := v_transaction.created_by;
  end if;

  if exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_transaction.assigned_agent_id
      and membership.is_active
  ) then
    v_assignee := v_transaction.assigned_agent_id;
  end if;

  insert into public.tasks (
    organization_id, transaction_id, assigned_to, title,
    description, status, visibility, created_by
  )
  select
    v_transaction.organization_id,
    p_transaction_id,
    v_assignee,
    required_task.title,
    'Hluti af undirbúningi kaupsamnings.',
    'not_started',
    'internal',
    v_creator
  from unnest(array[
    'Staðfesta fjármögnun',
    'Yfirfara skilyrði tilboðs',
    'Staðfesta afhendingardag',
    'Safna nauðsynlegum skjölum',
    'Undirbúa kaupsamning',
    'Bóka undirritun'
  ]::text[]) with ordinality as required_task(title, sort_order)
  where not exists (
    select 1 from public.tasks existing
    where existing.transaction_id = p_transaction_id
      and existing.title = required_task.title
  );
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.activity_events (
      organization_id, transaction_id, actor_user_id, event_type,
      visibility, summary, metadata
    ) values (
      v_transaction.organization_id, p_transaction_id, v_creator,
      'contract_preparation_checklist_initialized', 'internal',
      'Undirbúningur kaupsamnings hafinn',
      jsonb_build_object('task_count', v_inserted)
    );
  end if;
  return v_inserted;
end;
$$;

revoke all on function private.ensure_contract_preparation_tasks(uuid,uuid)
  from public, anon, authenticated;

comment on function public.buyer_property_summary(uuid) is
  'Buyer-safe property projection with current transaction stage; requires active accepted-buyer portal access.';

-- Centralize Icelandic summaries for agent-controlled offer transitions that
-- already go through the existing append-only transition helper.
create or replace function private.append_offer_transition(
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
  v_reason text;
  v_summary text;
begin
  select * into strict v_offer
  from public.offers
  where id = p_offer_id;

  v_reason := case p_event_type
    when 'offer_draft_created' then 'Drög að tilboði stofnuð'
    when 'offer_agent_approved' then 'Tilboð yfirfarið af fasteignasala'
    when 'offer_sent_to_seller' then 'Tilboð sent seljanda'
    else nullif(trim(p_reason), '')
  end;
  v_summary := case p_event_type
    when 'offer_draft_created' then 'Drög að tilboði stofnuð'
    when 'offer_change_requested' then 'Fasteignasali óskaði eftir breytingu á tilboði'
    when 'offer_agent_approved' then 'Fasteignasali fór yfir tilboðið'
    when 'offer_sent_to_seller' then 'Tilboð sent seljanda'
    else p_summary
  end;

  insert into public.offer_status_history (
    organization_id, offer_id, from_status, to_status, changed_by, reason
  ) values (
    v_offer.organization_id, p_offer_id, p_from_status, p_to_status,
    p_changed_by, v_reason
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_offer.organization_id, v_offer.transaction_id, p_changed_by,
    p_event_type, p_visibility, v_summary,
    jsonb_build_object(
      'offer_id', p_offer_id,
      'from_status', p_from_status,
      'to_status', p_to_status
    )
  );
end;
$$;

revoke all on function private.append_offer_transition(
  uuid,public.offer_status,public.offer_status,uuid,text,text,
  public.activity_visibility,text
) from public, anon, authenticated;

create or replace function public.save_buyer_offer_draft(
  p_offer_id uuid,
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
  v_offer public.offers%rowtype;
  v_contact_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(
    v_offer.transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if v_contact_id is null or v_contact_id is distinct from v_offer.buyer_contact_id then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  if v_offer.status not in ('draft', 'change_requested') then
    raise exception 'Offer is not editable' using errcode = '23514';
  end if;
  if p_amount_isk <= 0 then
    raise exception 'Offer amount must be positive' using errcode = '22023';
  end if;

  update public.offers
  set amount_isk = p_amount_isk,
      valid_until = p_valid_until,
      requested_handover_date = p_requested_handover_date,
      buyer_user_id = auth.uid()
  where id = p_offer_id;
  perform private.replace_offer_conditions(p_offer_id, p_conditions);
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_offer.organization_id, v_offer.transaction_id, null,
    'offer_draft_updated', 'buyer', 'Drög að tilboði uppfærð',
    jsonb_build_object('offer_id', p_offer_id, 'buyer_user_id', auth.uid())
  );
  return public.buyer_offer_status(p_offer_id);
end;
$$;

revoke all on function public.save_buyer_offer_draft(
  uuid,bigint,timestamptz,date,jsonb
) from public, anon;
grant execute on function public.save_buyer_offer_draft(
  uuid,bigint,timestamptz,date,jsonb
) to authenticated;

create or replace function public.submit_offer(p_offer_id uuid)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_from public.offer_status;
  v_internal_actor uuid;
  v_contact_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(
    v_offer.transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if private.can_manage_offer(p_offer_id, v_user_id) then
    v_internal_actor := v_user_id;
  elsif v_contact_id is null or v_contact_id is distinct from v_offer.buyer_contact_id then
    raise exception 'Not authorized to submit this offer' using errcode = '42501';
  end if;
  if v_offer.status not in ('draft', 'change_requested') then
    raise exception 'Only a draft or change-requested offer can be submitted' using errcode = '23514';
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
  return v_offer;
end;
$$;

revoke all on function public.submit_offer(uuid) from public, anon;
grant execute on function public.submit_offer(uuid) to authenticated;

create or replace function public.record_seller_offer_intent(
  p_offer_id uuid,
  p_seller_contact_id uuid,
  p_intent public.seller_intent
)
returns public.seller_offer_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_response public.seller_offer_responses%rowtype;
  v_summary text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if not private.can_manage_offer(p_offer_id, v_user_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_offer.status not in ('sent_to_seller', 'seller_intent_recorded') then
    raise exception 'Offer has not been sent to seller' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.transaction_parties party
    where party.transaction_id = v_offer.transaction_id
      and party.contact_id = p_seller_contact_id
      and party.role in ('seller', 'co_owner')
  ) then
    raise exception 'Contact is not a seller party' using errcode = '42501';
  end if;

  insert into public.seller_offer_responses (
    organization_id, offer_id, seller_contact_id, intent, submitted_by
  ) values (
    v_offer.organization_id, p_offer_id, p_seller_contact_id, p_intent, v_user_id
  ) returning * into v_response;
  update public.offers set status = 'seller_intent_recorded' where id = p_offer_id;
  v_summary := case p_intent
    when 'accept' then 'Seljandi samþykkti tilboð'
    when 'reject' then 'Seljandi hafnaði tilboði'
    else 'Seljandi óskaði eftir móttilboði'
  end;
  perform private.append_offer_transition(
    p_offer_id, v_offer.status, 'seller_intent_recorded', v_user_id,
    v_summary, 'seller_offer_intent_recorded', 'internal', v_summary
  );
  return v_response;
end;
$$;

revoke all on function public.record_seller_offer_intent(
  uuid,uuid,public.seller_intent
) from public, anon;
grant execute on function public.record_seller_offer_intent(
  uuid,uuid,public.seller_intent
) to authenticated;

create or replace function public.record_customer_seller_offer_intent(
  p_offer_id uuid,
  p_intent public.seller_intent
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers%rowtype;
  v_contact_id uuid;
  v_summary text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  v_contact_id := private.portal_contact_id(
    v_offer.transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  );
  if v_contact_id is null or v_offer.sent_to_seller_at is null then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  if v_offer.status not in ('sent_to_seller', 'seller_intent_recorded') then
    raise exception 'Offer is not available for seller response' using errcode = '23514';
  end if;

  insert into public.seller_offer_responses (
    organization_id, offer_id, seller_contact_id, intent, submitted_by
  ) values (
    v_offer.organization_id, p_offer_id, v_contact_id, p_intent, auth.uid()
  );
  update public.offers set status = 'seller_intent_recorded' where id = p_offer_id;
  v_summary := case p_intent
    when 'accept' then 'Seljandi samþykkti tilboð'
    when 'reject' then 'Seljandi hafnaði tilboði'
    else 'Seljandi óskaði eftir móttilboði'
  end;
  insert into public.offer_status_history (
    organization_id, offer_id, from_status, to_status, changed_by, reason
  ) values (
    v_offer.organization_id, p_offer_id, v_offer.status,
    'seller_intent_recorded', auth.uid(), v_summary
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_offer.organization_id, v_offer.transaction_id, null,
    'seller_offer_intent_recorded', 'internal', v_summary,
    jsonb_build_object(
      'offer_id', p_offer_id,
      'customer_user_id', auth.uid(),
      'intent', p_intent
    )
  );
  return public.seller_offer_summary(p_offer_id);
end;
$$;

revoke all on function public.record_customer_seller_offer_intent(
  uuid,public.seller_intent
) from public, anon;
grant execute on function public.record_customer_seller_offer_intent(
  uuid,public.seller_intent
) to authenticated;

create or replace function public.create_customer_offer_draft(
  p_transaction_id uuid,
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
  v_user_id uuid := auth.uid();
  v_contact_id uuid;
  v_org_id uuid;
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  v_contact_id := private.portal_contact_id(
    p_transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if v_contact_id is null then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;
  select organization_id into v_org_id
  from public.transactions
  where id = p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  if p_amount_isk <= 0 or p_valid_until <= now() then
    raise exception 'Invalid offer values' using errcode = '22023';
  end if;

  insert into public.offers (
    organization_id, transaction_id, buyer_contact_id, buyer_user_id,
    amount_isk, valid_until, requested_handover_date, status, created_by
  ) values (
    v_org_id, p_transaction_id, v_contact_id, v_user_id,
    p_amount_isk, p_valid_until, p_requested_handover_date, 'draft', null
  ) returning * into v_offer;
  perform private.replace_offer_conditions(v_offer.id, p_conditions);
  insert into public.offer_status_history (
    organization_id, offer_id, from_status, to_status, changed_by, reason
  ) values (
    v_org_id, v_offer.id, null, 'draft', v_user_id, 'Drög að tilboði stofnuð'
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_org_id, p_transaction_id, null, 'offer_draft_created', 'buyer',
    'Drög að tilboði stofnuð',
    jsonb_build_object('offer_id', v_offer.id, 'buyer_user_id', v_user_id)
  );
  return public.buyer_offer_status(v_offer.id);
end;
$$;

revoke all on function public.create_customer_offer_draft(
  uuid,bigint,timestamptz,date,jsonb
) from public, anon;
grant execute on function public.create_customer_offer_draft(
  uuid,bigint,timestamptz,date,jsonb
) to authenticated;
