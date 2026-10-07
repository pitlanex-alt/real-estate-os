-- Mó Phase 8B: initialize contract-preparation work as ordinary internal tasks.

create function private.ensure_contract_preparation_tasks(
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
      'Contract preparation checklist initialized',
      jsonb_build_object('task_count', v_inserted)
    );
  end if;
  return v_inserted;
end;
$$;

revoke all on function private.ensure_contract_preparation_tasks(uuid,uuid)
  from public, anon, authenticated;

create function private.initialize_contract_preparation_on_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage = 'contract' and old.stage is distinct from new.stage then
    perform private.ensure_contract_preparation_tasks(new.id, auth.uid());
  end if;
  return null;
end;
$$;

create trigger transactions_initialize_contract_preparation
after update of stage on public.transactions
for each row execute function private.initialize_contract_preparation_on_stage_change();

-- Safely initialize transactions that were already handed off before this migration.
do $$
declare v_transaction record;
begin
  for v_transaction in
    select transaction.id
    from public.transactions transaction
    where transaction.stage = 'contract'
      and exists (
        select 1 from public.offers offer
        where offer.transaction_id = transaction.id
          and offer.status = 'accepted'
      )
  loop
    perform private.ensure_contract_preparation_tasks(v_transaction.id, null);
  end loop;
end $$;

comment on function private.ensure_contract_preparation_tasks(uuid,uuid) is
  'Idempotently creates the six internal Phase 8B tasks after an accepted-offer handoff.';
