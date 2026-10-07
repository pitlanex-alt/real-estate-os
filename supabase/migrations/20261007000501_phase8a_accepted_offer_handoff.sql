-- Mó Phase 8A: agent-controlled accepted offer handoff.
-- This records internal workflow state only; it does not create a legal contract.

create function public.confirm_offer_outcome(
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
      'offer_accepted_internal', 'internal', 'Offer accepted in internal workflow'
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
        'Another offer was confirmed accepted',
        'offer_superseded_after_acceptance', 'internal',
        'Competing offer superseded after accepted offer'
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
        'Offer confirmed accepted by responsible agent'
      );
      insert into public.activity_events (
        organization_id, transaction_id, actor_user_id, event_type,
        visibility, summary, metadata
      ) values (
        v_transaction.organization_id, v_transaction.id, v_actor,
        'transaction_stage_advanced', 'internal',
        'Transaction moved to contract preparation',
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
      'offer_rejected_internal', 'internal', 'Offer rejected in internal workflow'
    );
  end if;

  return jsonb_build_object(
    'offer_id', p_offer_id,
    'status', p_outcome,
    'transaction_id', v_offer.transaction_id,
    'transaction_stage', case when p_outcome = 'accepted' then 'contract' else v_transaction.stage::text end
  );
end;
$$;

revoke all on function public.confirm_offer_outcome(uuid,public.offer_status,text)
  from public, anon;
grant execute on function public.confirm_offer_outcome(uuid,public.offer_status,text)
  to authenticated;

create or replace function public.customer_transaction_offers(p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seller boolean;
  v_buyer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_seller := private.has_portal_access(
    p_transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  );
  v_buyer := private.has_portal_access(
    p_transaction_id,
    array['accepted_buyer']::public.party_role[]
  );
  if not v_seller and not v_buyer then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', offer.id,
      'status', offer.status,
      'amount_isk', offer.amount_isk,
      'valid_until', offer.valid_until
    ) order by offer.created_at desc)
    from public.offers offer
    where offer.transaction_id = p_transaction_id
      and (
        (v_seller and offer.status in (
          'sent_to_seller', 'seller_intent_recorded',
          'accepted', 'rejected', 'superseded'
        ))
        or (v_buyer and offer.buyer_user_id = auth.uid())
      )
  ), '[]'::jsonb);
end;
$$;

comment on function public.confirm_offer_outcome(uuid,public.offer_status,text) is
  'Agent-controlled internal accepted/rejected outcome. Acceptance advances workflow but does not create a legal contract.';
