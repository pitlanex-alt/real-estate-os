-- Kelvo F-04: stable machine identities for required lifecycle tasks.
-- Visible task titles remain editable presentation text. Workflow gates and
-- checklist initialization use workflow_key exclusively after this migration.

alter table public.tasks
  add column workflow_key text;

alter table public.tasks
  add constraint tasks_workflow_key_format_check
  check (
    workflow_key is null
    or workflow_key ~ '^(contract|closing|handover)_[a-z0-9_]+$'
  );

-- Legacy generated tasks did not have a machine identity. Use lifecycle
-- history/current stage and (for contract tasks) an accepted offer to narrow
-- candidates before using their legacy title for this one-time backfill.
-- If duplicate legacy rows exist, prefer the canonical generated description
-- and then the row closest to the relevant stage transition.
with workflow_definitions(workflow_key, legacy_title, workflow_stage, canonical_description) as (
  values
    ('contract_confirm_financing', 'Staðfesta fjármögnun', 'contract', 'Hluti af undirbúningi kaupsamnings.'),
    ('contract_review_offer_conditions', 'Yfirfara skilyrði tilboðs', 'contract', 'Hluti af undirbúningi kaupsamnings.'),
    ('contract_confirm_handover_date', 'Staðfesta afhendingardag', 'contract', 'Hluti af undirbúningi kaupsamnings.'),
    ('contract_collect_documents', 'Safna nauðsynlegum skjölum', 'contract', 'Hluti af undirbúningi kaupsamnings.'),
    ('contract_prepare_purchase_agreement', 'Undirbúa kaupsamning', 'contract', 'Hluti af undirbúningi kaupsamnings.'),
    ('contract_book_signing', 'Bóka undirritun', 'contract', 'Hluti af undirbúningi kaupsamnings.'),
    ('closing_complete_contract_conditions', 'Ljúka skilyrðum kaupsamnings', 'closing', 'Hluti af frágangi viðskipta fyrir afhendingu.'),
    ('closing_confirm_financing_payments', 'Staðfesta fjármögnun og greiðslur', 'closing', 'Hluti af frágangi viðskipta fyrir afhendingu.'),
    ('closing_prepare_final_documents', 'Undirbúa lokaskjöl', 'closing', 'Hluti af frágangi viðskipta fyrir afhendingu.'),
    ('closing_confirm_handover_readiness', 'Staðfesta stöðu fyrir afhendingu', 'closing', 'Hluti af frágangi viðskipta fyrir afhendingu.'),
    ('closing_confirm_handover_time', 'Staðfesta afhendingartíma', 'closing', 'Hluti af frágangi viðskipta fyrir afhendingu.'),
    ('handover_confirm_date_time', 'Staðfesta afhendingardag og tíma', 'handover', 'Hluti af undirbúningi og skráningu afhendingar eignar.'),
    ('handover_confirm_payments_conditions', 'Staðfesta að greiðslur og skilyrði séu frágengin', 'handover', 'Hluti af undirbúningi og skráningu afhendingar eignar.'),
    ('handover_prepare_keys', 'Undirbúa afhendingu lykla', 'handover', 'Hluti af undirbúningi og skráningu afhendingar eignar.'),
    ('handover_record_handover', 'Skrá afhendingu eignar', 'handover', 'Hluti af undirbúningi og skráningu afhendingar eignar.'),
    ('handover_complete_remaining_documents', 'Ljúka eftirstandandi gögnum', 'handover', 'Hluti af undirbúningi og skráningu afhendingar eignar.')
), candidates as (
  select
    task.id,
    definition.workflow_key,
    row_number() over (
      partition by task.transaction_id, definition.workflow_key
      order by
        (task.description is not distinct from definition.canonical_description) desc,
        case
          when stage_history.reached_at is not null and task.created_at >= stage_history.reached_at then 0
          else 1
        end,
        abs(extract(epoch from (task.created_at - coalesce(stage_history.reached_at, task.created_at)))),
        task.created_at,
        task.id
    ) as candidate_rank
  from public.tasks task
  join workflow_definitions definition
    on definition.legacy_title = task.title
  join public.transactions transaction
    on transaction.id = task.transaction_id
   and transaction.organization_id = task.organization_id
  left join lateral (
    select min(history.created_at) as reached_at
    from public.transaction_stage_history history
    where history.transaction_id = task.transaction_id
      and history.to_stage::text = definition.workflow_stage
  ) stage_history on true
  where task.workflow_key is null
    and (
      stage_history.reached_at is not null
      or (definition.workflow_stage = 'contract' and transaction.stage::text in ('contract', 'closing', 'handover', 'completed'))
      or (definition.workflow_stage = 'closing' and transaction.stage::text in ('closing', 'handover', 'completed'))
      or (definition.workflow_stage = 'handover' and transaction.stage::text in ('handover', 'completed'))
    )
    and (
      definition.workflow_stage <> 'contract'
      or exists (
        select 1
        from public.offers offer
        where offer.transaction_id = task.transaction_id
          and offer.status = 'accepted'
      )
    )
)
update public.tasks task
set workflow_key = candidate.workflow_key
from candidates candidate
where task.id = candidate.id
  and candidate.candidate_rank = 1;

create unique index tasks_transaction_workflow_key_unique
  on public.tasks (transaction_id, workflow_key)
  where workflow_key is not null;

create function private.prevent_task_workflow_key_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.workflow_key is distinct from new.workflow_key then
    raise exception 'Workflow task identity is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tasks_workflow_key_immutable
before update of workflow_key on public.tasks
for each row execute function private.prevent_task_workflow_key_change();

revoke all on function private.prevent_task_workflow_key_change()
  from public, anon, authenticated;

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
    organization_id, transaction_id, assigned_to, title, workflow_key,
    description, status, visibility, created_by
  )
  select
    v_transaction.organization_id,
    p_transaction_id,
    v_assignee,
    required_task.title,
    required_task.workflow_key,
    'Hluti af undirbúningi kaupsamnings.',
    'not_started',
    'internal',
    v_creator
  from (values
    ('contract_confirm_financing', 'Staðfesta fjármögnun'),
    ('contract_review_offer_conditions', 'Yfirfara skilyrði tilboðs'),
    ('contract_confirm_handover_date', 'Staðfesta afhendingardag'),
    ('contract_collect_documents', 'Safna nauðsynlegum skjölum'),
    ('contract_prepare_purchase_agreement', 'Undirbúa kaupsamning'),
    ('contract_book_signing', 'Bóka undirritun')
  ) as required_task(workflow_key, title)
  where not exists (
    select 1 from public.tasks existing
    where existing.transaction_id = p_transaction_id
      and existing.workflow_key = required_task.workflow_key
  )
  on conflict (transaction_id, workflow_key)
    where workflow_key is not null
    do nothing;
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

create or replace function public.confirm_contract_signing(p_transaction_id uuid)
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
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  select * into v_transaction from public.transactions
  where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_actor and membership.is_active
      and membership.role in ('admin', 'agent', 'coordinator')
  ) or not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_transaction.stage = 'closing' then
    return jsonb_build_object('transaction_id', p_transaction_id, 'stage', 'closing', 'already_confirmed', true, 'created_tasks', 0);
  end if;
  if v_transaction.stage <> 'contract' then
    raise exception 'Transaction is not in contract preparation' using errcode = '23514';
  end if;

  select offer.id into v_accepted_offer_id from public.offers offer
  where offer.transaction_id = p_transaction_id and offer.status = 'accepted'
  order by offer.updated_at desc, offer.id limit 1;
  if v_accepted_offer_id is null then raise exception 'Accepted offer required' using errcode = '23514'; end if;

  if exists (
    select 1 from unnest(array[
      'contract_confirm_financing',
      'contract_review_offer_conditions',
      'contract_confirm_handover_date',
      'contract_collect_documents',
      'contract_prepare_purchase_agreement',
      'contract_book_signing'
    ]::text[]) required_task(workflow_key)
    where not exists (
      select 1 from public.tasks task
      where task.transaction_id = p_transaction_id
        and task.workflow_key = required_task.workflow_key
        and task.status = 'completed'
    )
  ) then
    raise exception 'Contract preparation is incomplete' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_transaction.assigned_agent_id and membership.is_active
  ) then v_assignee := v_transaction.assigned_agent_id; end if;

  update public.transactions set stage = 'closing' where id = p_transaction_id;
  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, 'contract', 'closing', v_actor,
    'Undirritun kaupsamnings staðfest', v_confirmed_at
  );

  insert into public.tasks (
    organization_id, transaction_id, assigned_to, title, workflow_key,
    description, status, due_at, visibility, created_by
  )
  select v_transaction.organization_id, p_transaction_id, v_assignee,
    closing_task.title, closing_task.workflow_key,
    'Hluti af frágangi viðskipta fyrir afhendingu.', 'not_started',
    v_confirmed_at + make_interval(days => closing_task.due_in_days), 'internal', v_actor
  from (values
    ('closing_complete_contract_conditions', 'Ljúka skilyrðum kaupsamnings', 2),
    ('closing_confirm_financing_payments', 'Staðfesta fjármögnun og greiðslur', 3),
    ('closing_prepare_final_documents', 'Undirbúa lokaskjöl', 5),
    ('closing_confirm_handover_readiness', 'Staðfesta stöðu fyrir afhendingu', 7),
    ('closing_confirm_handover_time', 'Staðfesta afhendingartíma', 8)
  ) as closing_task(workflow_key, title, due_in_days)
  where not exists (
    select 1 from public.tasks existing
    where existing.transaction_id = p_transaction_id
      and existing.workflow_key = closing_task.workflow_key
  )
  on conflict (transaction_id, workflow_key)
    where workflow_key is not null
    do nothing;
  get diagnostics v_inserted_tasks = row_count;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor, 'contract_signing_confirmed', 'seller_and_buyer',
    'Undirritun kaupsamnings staðfest',
    jsonb_build_object('from_stage', 'contract', 'to_stage', 'closing', 'accepted_offer_id', v_accepted_offer_id), v_confirmed_at
  ), (
    v_transaction.organization_id, p_transaction_id, v_actor, 'closing_checklist_initialized', 'internal',
    'Frágangur viðskipta hafinn', jsonb_build_object('task_count', v_inserted_tasks), v_confirmed_at
  );

  return jsonb_build_object(
    'transaction_id', p_transaction_id, 'stage', 'closing', 'accepted_offer_id', v_accepted_offer_id,
    'confirmed_at', v_confirmed_at, 'confirmed_by', v_actor,
    'already_confirmed', false, 'created_tasks', v_inserted_tasks
  );
end;
$$;

revoke all on function public.confirm_contract_signing(uuid) from public, anon;
grant execute on function public.confirm_contract_signing(uuid) to authenticated;

comment on function public.confirm_contract_signing(uuid) is
  'Authorized, idempotent contract-signing milestone gated by six stable workflow task keys.';

create or replace function public.confirm_transaction_ready_for_handover(p_transaction_id uuid)
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
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_transaction from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_actor and membership.is_active
      and membership.role in ('admin', 'agent', 'coordinator')
  ) or not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_transaction.stage = 'handover' then
    return jsonb_build_object('transaction_id', p_transaction_id, 'stage', 'handover', 'already_confirmed', true, 'created_tasks', 0);
  end if;
  if v_transaction.stage <> 'closing' then
    raise exception 'Transaction is not in closing' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(array[
      'closing_complete_contract_conditions',
      'closing_confirm_financing_payments',
      'closing_prepare_final_documents',
      'closing_confirm_handover_readiness',
      'closing_confirm_handover_time'
    ]::text[]) required_task(workflow_key)
    where not exists (
      select 1 from public.tasks task
      where task.transaction_id = p_transaction_id
        and task.workflow_key = required_task.workflow_key
        and task.status = 'completed'
    )
  ) then
    raise exception 'Closing checklist is incomplete' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_transaction.assigned_agent_id and membership.is_active
  ) then v_assignee := v_transaction.assigned_agent_id; end if;

  update public.transactions set stage = 'handover' where id = p_transaction_id;
  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, 'closing', 'handover', v_actor,
    'Eign staðfest tilbúin til afhendingar', v_confirmed_at
  );

  insert into public.tasks (
    organization_id, transaction_id, assigned_to, title, workflow_key,
    description, status, due_at, visibility, created_by
  )
  select v_transaction.organization_id, p_transaction_id, v_assignee,
    handover_task.title, handover_task.workflow_key,
    'Hluti af undirbúningi og skráningu afhendingar eignar.', 'not_started',
    v_confirmed_at + make_interval(days => handover_task.due_in_days), 'internal', v_actor
  from (values
    ('handover_confirm_date_time', 'Staðfesta afhendingardag og tíma', 1),
    ('handover_confirm_payments_conditions', 'Staðfesta að greiðslur og skilyrði séu frágengin', 1),
    ('handover_prepare_keys', 'Undirbúa afhendingu lykla', 2),
    ('handover_record_handover', 'Skrá afhendingu eignar', 3),
    ('handover_complete_remaining_documents', 'Ljúka eftirstandandi gögnum', 4)
  ) as handover_task(workflow_key, title, due_in_days)
  where not exists (
    select 1 from public.tasks existing
    where existing.transaction_id = p_transaction_id
      and existing.workflow_key = handover_task.workflow_key
  )
  on conflict (transaction_id, workflow_key)
    where workflow_key is not null
    do nothing;
  get diagnostics v_inserted_tasks = row_count;

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor, 'property_ready_for_handover', 'seller_and_buyer',
    'Eign tilbúin til afhendingar', jsonb_build_object('from_stage', 'closing', 'to_stage', 'handover'), v_confirmed_at
  ), (
    v_transaction.organization_id, p_transaction_id, v_actor, 'handover_checklist_initialized', 'internal',
    'Undirbúningur afhendingar hafinn', jsonb_build_object('task_count', v_inserted_tasks), v_confirmed_at
  );

  return jsonb_build_object(
    'transaction_id', p_transaction_id, 'stage', 'handover',
    'confirmed_at', v_confirmed_at, 'confirmed_by', v_actor,
    'already_confirmed', false, 'created_tasks', v_inserted_tasks
  );
end;
$$;

revoke all on function public.confirm_transaction_ready_for_handover(uuid) from public, anon;
grant execute on function public.confirm_transaction_ready_for_handover(uuid) to authenticated;

comment on function public.confirm_transaction_ready_for_handover(uuid) is
  'Authorized, idempotent closing milestone gated by five stable workflow task keys.';

create or replace function public.confirm_transaction_completion(p_transaction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transaction public.transactions%rowtype;
  v_completed_at timestamptz := now();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_transaction from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = v_transaction.organization_id
      and membership.user_id = v_actor and membership.is_active
      and membership.role in ('admin', 'agent', 'coordinator')
  ) or not private.can_manage_transaction(p_transaction_id, v_actor) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if v_transaction.stage = 'completed' then
    return jsonb_build_object(
      'transaction_id', p_transaction_id, 'stage', 'completed',
      'completed_at', v_transaction.completed_at, 'already_completed', true
    );
  end if;
  if v_transaction.stage <> 'handover' then
    raise exception 'Transaction is not in handover' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(array[
      'handover_confirm_date_time',
      'handover_confirm_payments_conditions',
      'handover_prepare_keys',
      'handover_record_handover',
      'handover_complete_remaining_documents'
    ]::text[]) required_task(workflow_key)
    where not exists (
      select 1 from public.tasks task
      where task.transaction_id = p_transaction_id
        and task.workflow_key = required_task.workflow_key
        and task.status = 'completed'
    )
  ) then
    raise exception 'Handover checklist is incomplete' using errcode = '23514';
  end if;

  update public.transactions set stage = 'completed', completed_at = v_completed_at
  where id = p_transaction_id;
  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, 'handover', 'completed', v_actor,
    'Viðskiptum lokið', v_completed_at
  );
  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type, visibility, summary, metadata, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor, 'transaction_completed', 'seller_and_buyer',
    'Viðskiptum lokið', jsonb_build_object('from_stage', 'handover', 'to_stage', 'completed'), v_completed_at
  );

  return jsonb_build_object(
    'transaction_id', p_transaction_id, 'stage', 'completed',
    'completed_at', v_completed_at, 'completed_by', v_actor, 'already_completed', false
  );
end;
$$;

revoke all on function public.confirm_transaction_completion(uuid) from public, anon;
grant execute on function public.confirm_transaction_completion(uuid) to authenticated;

comment on function public.confirm_transaction_completion(uuid) is
  'Authorized, idempotent final milestone gated by five stable workflow task keys.';
