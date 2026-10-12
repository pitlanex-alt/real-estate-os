-- Kelvo: final transaction completion milestone and customer-response/activity copy fixes.

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
    p_response_type, v_feedback, v_transaction.listing_revision
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
      'feedback', v_feedback,
      'customer_user_id', v_actor,
      'seller_contact_id', v_contact_id,
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

create or replace function public.create_task(
  p_transaction_id uuid, p_title text, p_description text default null,
  p_assigned_to uuid default null, p_due_at timestamptz default null,
  p_visibility public.activity_visibility default 'internal'
)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_org uuid; v_task public.tasks%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select organization_id into v_org from public.transactions where id=p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(p_transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Task title required' using errcode='22023'; end if;
  if p_assigned_to is not null and not private.is_org_member(v_org,p_assigned_to) then raise exception 'Assignee is not an active organization member' using errcode='42501'; end if;
  insert into public.tasks(organization_id,transaction_id,assigned_to,title,description,due_at,visibility,created_by)
  values(v_org,p_transaction_id,p_assigned_to,trim(p_title),nullif(trim(p_description),''),p_due_at,p_visibility,v_actor) returning * into v_task;
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_org,p_transaction_id,v_actor,'task_created','internal',format('Verkefnið „%s“ stofnað',v_task.title),jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  return v_task;
end $$;

create or replace function public.complete_task(p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_task public.tasks%rowtype; v_was_completed boolean;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_task.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  v_was_completed := v_task.status = 'completed';
  update public.tasks set status='completed',completed_at=coalesce(completed_at,now()) where id=p_task_id returning * into v_task;
  if not v_was_completed then
    insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
    values(v_task.organization_id,v_task.transaction_id,v_actor,'task_completed',v_task.visibility,format('Verkefninu „%s“ lokið',v_task.title),jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  end if;
  return v_task;
end $$;

create or replace function public.update_task(
  p_task_id uuid, p_title text, p_description text,
  p_assigned_to uuid, p_due_at timestamptz, p_status public.task_status,
  p_visibility public.activity_visibility
)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_previous_status public.task_status;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_task.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Task title required' using errcode='22023'; end if;
  if p_assigned_to is not null and not private.is_org_member(v_task.organization_id,p_assigned_to) then raise exception 'Invalid assignee' using errcode='42501'; end if;
  v_previous_status := v_task.status;
  update public.tasks set
    title=trim(p_title), description=nullif(trim(p_description),''),
    assigned_to=p_assigned_to, due_at=p_due_at, status=p_status, visibility=p_visibility,
    completed_at=case when p_status='completed' then coalesce(completed_at,now()) else null end
  where id=p_task_id returning * into v_task;
  if p_status = 'completed' and v_previous_status <> 'completed' then
    insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
    values(v_task.organization_id,v_task.transaction_id,v_actor,'task_completed',v_task.visibility,format('Verkefninu „%s“ lokið',v_task.title),jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  elsif p_status = 'cancelled' and v_previous_status <> 'cancelled' then
    insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
    values(v_task.organization_id,v_task.transaction_id,v_actor,'task_cancelled','internal',format('Hætt við verkefnið „%s“',v_task.title),jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  end if;
  return v_task;
end $$;

create or replace function public.cancel_task(p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_task public.tasks%rowtype; v_was_cancelled boolean;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_task.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  v_was_cancelled := v_task.status = 'cancelled';
  update public.tasks set status='cancelled',completed_at=null where id=p_task_id returning * into v_task;
  if not v_was_cancelled then
    insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
    values(v_task.organization_id,v_task.transaction_id,v_actor,'task_cancelled','internal',format('Hætt við verkefnið „%s“',v_task.title),jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  end if;
  return v_task;
end $$;

revoke all on function public.create_task(uuid,text,text,uuid,timestamptz,public.activity_visibility) from public, anon;
revoke all on function public.update_task(uuid,text,text,uuid,timestamptz,public.task_status,public.activity_visibility) from public, anon;
revoke all on function public.complete_task(uuid), public.cancel_task(uuid) from public, anon;
grant execute on function public.create_task(uuid,text,text,uuid,timestamptz,public.activity_visibility) to authenticated;
grant execute on function public.update_task(uuid,text,text,uuid,timestamptz,public.task_status,public.activity_visibility) to authenticated;
grant execute on function public.complete_task(uuid), public.cancel_task(uuid) to authenticated;

create function public.confirm_transaction_completion(p_transaction_id uuid)
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
  -- concurrent confirmations so history and activity remain singular.
  if v_transaction.stage = 'completed' then
    return jsonb_build_object(
      'transaction_id', p_transaction_id,
      'stage', 'completed',
      'completed_at', v_transaction.completed_at,
      'already_completed', true
    );
  end if;

  if v_transaction.stage <> 'handover' then
    raise exception 'Transaction is not in handover' using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(array[
      'Staðfesta afhendingardag og tíma',
      'Staðfesta að greiðslur og skilyrði séu frágengin',
      'Undirbúa afhendingu lykla',
      'Skrá afhendingu eignar',
      'Ljúka eftirstandandi gögnum'
    ]::text[]) required_task(title)
    where not exists (
      select 1
      from public.tasks task
      where task.transaction_id = p_transaction_id
        and task.title = required_task.title
        and task.status = 'completed'
    )
  ) then
    raise exception 'Handover checklist is incomplete' using errcode = '23514';
  end if;

  update public.transactions
  set stage = 'completed', completed_at = v_completed_at
  where id = p_transaction_id;

  insert into public.transaction_stage_history (
    organization_id, transaction_id, from_stage, to_stage, changed_by, reason, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id,
    'handover', 'completed', v_actor,
    'Viðskiptum lokið', v_completed_at
  );

  insert into public.activity_events (
    organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata, created_at
  ) values (
    v_transaction.organization_id, p_transaction_id, v_actor,
    'transaction_completed', 'seller_and_buyer',
    'Viðskiptum lokið',
    jsonb_build_object('from_stage', 'handover', 'to_stage', 'completed'),
    v_completed_at
  );

  return jsonb_build_object(
    'transaction_id', p_transaction_id,
    'stage', 'completed',
    'completed_at', v_completed_at,
    'completed_by', v_actor,
    'already_completed', false
  );
end;
$$;

revoke all on function public.confirm_transaction_completion(uuid) from public, anon;
grant execute on function public.confirm_transaction_completion(uuid) to authenticated;

comment on function public.confirm_transaction_completion(uuid) is
  'Authorized, idempotent final milestone: archives a handover transaction as completed after all required handover tasks are complete.';
