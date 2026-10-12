-- Kelvo: explicit closing-completion milestone and handover handoff.
-- This is an operational workflow transition; it does not perform legal delivery.

create function public.confirm_transaction_ready_for_handover(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
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

  -- Successful retries are no-ops. Locking the transaction row serializes
  -- concurrent confirmations and prevents duplicate history/checklist rows.
  if v_transaction.stage = 'handover' then
    return jsonb_build_object(
      'transaction_id', p_transaction_id,
      'stage', 'handover',
      'already_confirmed', true,
      'created_tasks', 0
    );
  end if;

  if v_transaction.stage <> 'closing' then
    raise exception 'Transaction is not in closing' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(array[
      'Ljúka skilyrðum kaupsamnings',
      'Staðfesta fjármögnun og greiðslur',
      'Undirbúa lokaskjöl',
      'Staðfesta stöðu fyrir afhendingu',
      'Staðfesta afhendingartíma'
    ]::text[]) required_task(title)
    where not exists (
      select 1
      from public.tasks task
      where task.transaction_id = p_transaction_id
        and task.title = required_task.title
        and task.status = 'completed'
    )
  ) then
    raise exception 'Closing checklist is incomplete' using errcode = '23514';
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
  set stage = 'handover'
  where id = p_transaction_id;

  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id,
    'closing', 'handover', v_actor,
    'Eign staðfest tilbúin til afhendingar', v_confirmed_at
  );

  insert into public.tasks (
    organization_id, transaction_id, assigned_to, title,
    description, status, due_at, visibility, created_by
  )
  select
    v_transaction.organization_id,
    p_transaction_id,
    v_assignee,
    handover_task.title,
    'Hluti af undirbúningi og skráningu afhendingar eignar.',
    'not_started',
    v_confirmed_at + make_interval(days => handover_task.due_in_days),
    'internal',
    v_actor
  from (values
    ('Staðfesta afhendingardag og tíma', 1),
    ('Staðfesta að greiðslur og skilyrði séu frágengin', 1),
    ('Undirbúa afhendingu lykla', 2),
    ('Skrá afhendingu eignar', 3),
    ('Ljúka eftirstandandi gögnum', 4)
  ) as handover_task(title, due_in_days)
  where not exists (
    select 1
    from public.tasks existing
    where existing.transaction_id = p_transaction_id
      and existing.title = handover_task.title
  );
  get diagnostics v_inserted_tasks = row_count;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'property_ready_for_handover', 'seller_and_buyer',
    'Eign tilbúin til afhendingar',
    jsonb_build_object('from_stage', 'closing', 'to_stage', 'handover'),
    v_confirmed_at
  ), (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'handover_checklist_initialized', 'internal',
    'Undirbúningur afhendingar hafinn',
    jsonb_build_object('task_count', v_inserted_tasks),
    v_confirmed_at
  );

  return jsonb_build_object(
    'transaction_id', p_transaction_id,
    'stage', 'handover',
    'confirmed_at', v_confirmed_at,
    'confirmed_by', v_actor,
    'already_confirmed', false,
    'created_tasks', v_inserted_tasks
  );
end;
$$;

revoke all on function public.confirm_transaction_ready_for_handover(uuid) from public, anon;
grant execute on function public.confirm_transaction_ready_for_handover(uuid) to authenticated;

comment on function public.confirm_transaction_ready_for_handover(uuid) is
  'Authorized, idempotent closing milestone: advances closing to handover and initializes five internal handover tasks.';

-- Milestone transitions must go through their dedicated guarded workflows.
-- Preserve the original general transition function for all other transitions.
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

  if (v_transaction.stage = 'contract' and p_next_stage = 'closing')
    or (v_transaction.stage = 'closing' and p_next_stage = 'handover')
    or (v_transaction.stage = 'handover' and p_next_stage = 'completed') then
    raise exception 'This stage transition requires its dedicated milestone workflow'
      using errcode = '23514';
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
    v_transaction.organization_id, p_transaction_id, v_from_stage,
    p_next_stage, v_user_id, nullif(trim(p_reason), '')
  );

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata
  ) values (
    v_transaction.organization_id, p_transaction_id, v_user_id,
    'transaction_stage_advanced', 'internal',
    format('Staða viðskipta uppfærð: %s', p_next_stage),
    jsonb_build_object(
      'from_stage', v_from_stage,
      'to_stage', p_next_stage,
      'reason', nullif(trim(p_reason), '')
    )
  );

  return v_transaction;
end;
$$;

revoke all on function public.advance_transaction_stage(uuid, public.transaction_stage, text)
  from public, anon;
grant execute on function public.advance_transaction_stage(uuid, public.transaction_stage, text)
  to authenticated;
