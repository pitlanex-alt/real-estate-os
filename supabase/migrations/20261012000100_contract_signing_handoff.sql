-- Kelvo: explicit contract-signing milestone and closing handoff.
-- This records the operational milestone only; Kelvo does not create or sign the legal agreement.

create function public.confirm_contract_signing(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_accepted_offer_id uuid;
  v_assignee uuid;
  v_confirmed_at timestamptz := now();
  v_inserted_tasks integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_transaction
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_actor
      and membership.is_active
      and membership.role in ('admin', 'agent', 'coordinator')
  ) or not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- A successful retry is a no-op. The transaction row lock also serializes
  -- simultaneous confirmations, so history and checklist rows cannot duplicate.
  if v_transaction.stage = 'closing' then
    return jsonb_build_object(
      'transaction_id', p_transaction_id,
      'stage', 'closing',
      'already_confirmed', true,
      'created_tasks', 0
    );
  end if;

  if v_transaction.stage <> 'contract' then
    raise exception 'Transaction is not in contract preparation' using errcode = '23514';
  end if;

  select offer.id into v_accepted_offer_id
  from public.offers offer
  where offer.transaction_id = p_transaction_id
    and offer.status = 'accepted'
  order by offer.updated_at desc, offer.id
  limit 1;

  if v_accepted_offer_id is null then
    raise exception 'Accepted offer required' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(array[
      'Staðfesta fjármögnun',
      'Yfirfara skilyrði tilboðs',
      'Staðfesta afhendingardag',
      'Safna nauðsynlegum skjölum',
      'Undirbúa kaupsamning',
      'Bóka undirritun'
    ]::text[]) required_task(title)
    where not exists (
      select 1
      from public.tasks task
      where task.transaction_id = p_transaction_id
        and task.title = required_task.title
        and task.status = 'completed'
    )
  ) then
    raise exception 'Contract preparation is incomplete' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_transaction.assigned_agent_id
      and membership.is_active
  ) then
    v_assignee := v_transaction.assigned_agent_id;
  end if;

  update public.transactions
  set stage = 'closing'
  where id = p_transaction_id;

  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id,
    'contract', 'closing', v_actor,
    'Undirritun kaupsamnings staðfest', v_confirmed_at
  );

  insert into public.tasks (
    organization_id, transaction_id, assigned_to, title,
    description, status, due_at, visibility, created_by
  )
  select
    v_transaction.organization_id,
    p_transaction_id,
    v_assignee,
    closing_task.title,
    'Hluti af frágangi viðskipta fyrir afhendingu.',
    'not_started',
    v_confirmed_at + make_interval(days => closing_task.due_in_days),
    'internal',
    v_actor
  from (values
    ('Ljúka skilyrðum kaupsamnings', 2),
    ('Staðfesta fjármögnun og greiðslur', 3),
    ('Undirbúa lokaskjöl', 5),
    ('Staðfesta stöðu fyrir afhendingu', 7),
    ('Staðfesta afhendingartíma', 8)
  ) as closing_task(title, due_in_days)
  where not exists (
    select 1
    from public.tasks existing
    where existing.transaction_id = p_transaction_id
      and existing.title = closing_task.title
  );
  get diagnostics v_inserted_tasks = row_count;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'contract_signing_confirmed', 'seller_and_buyer',
    'Undirritun kaupsamnings staðfest',
    jsonb_build_object(
      'from_stage', 'contract',
      'to_stage', 'closing',
      'accepted_offer_id', v_accepted_offer_id
    ),
    v_confirmed_at
  ), (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'closing_checklist_initialized', 'internal',
    'Frágangur viðskipta hafinn',
    jsonb_build_object('task_count', v_inserted_tasks),
    v_confirmed_at
  );

  return jsonb_build_object(
    'transaction_id', p_transaction_id,
    'stage', 'closing',
    'accepted_offer_id', v_accepted_offer_id,
    'confirmed_at', v_confirmed_at,
    'confirmed_by', v_actor,
    'already_confirmed', false,
    'created_tasks', v_inserted_tasks
  );
end;
$$;

revoke all on function public.confirm_contract_signing(uuid) from public, anon;
grant execute on function public.confirm_contract_signing(uuid) to authenticated;

comment on function public.confirm_contract_signing(uuid) is
  'Authorized, idempotent contract-signing milestone: advances contract to closing and initializes the five internal closing tasks.';
