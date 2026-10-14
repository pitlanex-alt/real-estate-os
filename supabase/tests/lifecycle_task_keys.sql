begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'f0400000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'workflow-agent-a@test.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Workflow Agent A"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0400000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'workflow-agent-b@test.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Workflow Agent B"}',
    now(), now(), '', '', '', ''
  );

insert into public.organizations (id, name) values
  ('f0400000-0000-4000-8000-000000000010', 'Workflow test A'),
  ('f0400000-0000-4000-8000-000000000011', 'Workflow test B');

insert into public.organization_memberships (organization_id, user_id, role, is_active) values
  ('f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000001', 'admin', true),
  ('f0400000-0000-4000-8000-000000000011', 'f0400000-0000-4000-8000-000000000002', 'admin', true);

insert into public.properties (id, organization_id, slug, address_line, postal_code, municipality) values
  ('f0400000-0000-4000-8000-000000000020', 'f0400000-0000-4000-8000-000000000010', 'workflow-a', 'Workflow gata 1', '101', 'Reykjavík'),
  ('f0400000-0000-4000-8000-000000000021', 'f0400000-0000-4000-8000-000000000010', 'workflow-b', 'Workflow gata 2', '101', 'Reykjavík'),
  ('f0400000-0000-4000-8000-000000000022', 'f0400000-0000-4000-8000-000000000010', 'workflow-c', 'Workflow gata 3', '101', 'Reykjavík'),
  ('f0400000-0000-4000-8000-000000000023', 'f0400000-0000-4000-8000-000000000011', 'workflow-d', 'Workflow gata 4', '101', 'Reykjavík');

insert into public.transactions (
  id, organization_id, property_id, assigned_agent_id, stage, created_by
) values
  ('f0400000-0000-4000-8000-000000000030', 'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000020', 'f0400000-0000-4000-8000-000000000001', 'offers', 'f0400000-0000-4000-8000-000000000001'),
  ('f0400000-0000-4000-8000-000000000031', 'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000021', 'f0400000-0000-4000-8000-000000000001', 'offers', 'f0400000-0000-4000-8000-000000000001'),
  ('f0400000-0000-4000-8000-000000000032', 'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000022', 'f0400000-0000-4000-8000-000000000001', 'offers', 'f0400000-0000-4000-8000-000000000001'),
  ('f0400000-0000-4000-8000-000000000033', 'f0400000-0000-4000-8000-000000000011', 'f0400000-0000-4000-8000-000000000023', 'f0400000-0000-4000-8000-000000000002', 'offers', 'f0400000-0000-4000-8000-000000000002');

insert into public.transaction_assignments (organization_id, transaction_id, user_id, role) values
  ('f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000030', 'f0400000-0000-4000-8000-000000000001', 'primary_agent'),
  ('f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000031', 'f0400000-0000-4000-8000-000000000001', 'primary_agent'),
  ('f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000032', 'f0400000-0000-4000-8000-000000000001', 'primary_agent'),
  ('f0400000-0000-4000-8000-000000000011', 'f0400000-0000-4000-8000-000000000033', 'f0400000-0000-4000-8000-000000000002', 'primary_agent');

insert into public.contacts (id, organization_id, full_name, created_by) values
  ('f0400000-0000-4000-8000-000000000040', 'f0400000-0000-4000-8000-000000000010', 'Workflow Buyer A', 'f0400000-0000-4000-8000-000000000001'),
  ('f0400000-0000-4000-8000-000000000041', 'f0400000-0000-4000-8000-000000000011', 'Workflow Buyer B', 'f0400000-0000-4000-8000-000000000002');

insert into public.offers (
  id, organization_id, transaction_id, buyer_contact_id, amount_isk,
  valid_until, requested_handover_date, status, created_by
) values
  ('f0400000-0000-4000-8000-000000000050', 'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000030', 'f0400000-0000-4000-8000-000000000040', 80000000, now() + interval '1 day', current_date + 30, 'accepted', 'f0400000-0000-4000-8000-000000000001'),
  ('f0400000-0000-4000-8000-000000000051', 'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000031', 'f0400000-0000-4000-8000-000000000040', 80000000, now() + interval '1 day', current_date + 30, 'accepted', 'f0400000-0000-4000-8000-000000000001'),
  ('f0400000-0000-4000-8000-000000000052', 'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000032', 'f0400000-0000-4000-8000-000000000040', 80000000, now() + interval '1 day', current_date + 30, 'accepted', 'f0400000-0000-4000-8000-000000000001'),
  ('f0400000-0000-4000-8000-000000000053', 'f0400000-0000-4000-8000-000000000011', 'f0400000-0000-4000-8000-000000000033', 'f0400000-0000-4000-8000-000000000041', 80000000, now() + interval '1 day', current_date + 30, 'accepted', 'f0400000-0000-4000-8000-000000000002');

-- Entering contract invokes the existing initializer trigger.
update public.transactions set stage = 'contract'
where id in (
  'f0400000-0000-4000-8000-000000000030',
  'f0400000-0000-4000-8000-000000000031',
  'f0400000-0000-4000-8000-000000000032',
  'f0400000-0000-4000-8000-000000000033'
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0400000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.tasks where transaction_id = 'f0400000-0000-4000-8000-000000000030' and workflow_key like 'contract\_%' escape '\'),
  6,
  'Contract initialization assigns all six stable workflow keys'
);
select is(
  private.ensure_contract_preparation_tasks('f0400000-0000-4000-8000-000000000030', 'f0400000-0000-4000-8000-000000000001'),
  0,
  'Repeated initialization creates no duplicate tasks'
);
select is(
  (select count(*)::integer from public.tasks where transaction_id = 'f0400000-0000-4000-8000-000000000030' and workflow_key is not null),
  6,
  'The workflow-key unique index preserves one task per requirement'
);

-- A visible-title edit leaves the machine identity intact.
select lives_ok(
  $$select public.update_task(
    (select id from public.tasks where transaction_id = 'f0400000-0000-4000-8000-000000000030' and workflow_key = 'contract_confirm_financing'),
    'Sérsniðinn sýnilegur titill', null, 'f0400000-0000-4000-8000-000000000001', null, 'completed', 'internal'
  )$$,
  'A generated task title can be renamed without changing its identity'
);
select is(
  (select workflow_key from public.tasks where transaction_id = 'f0400000-0000-4000-8000-000000000030' and title = 'Sérsniðinn sýnilegur titill'),
  'contract_confirm_financing',
  'Renaming preserves workflow_key'
);
select throws_ok(
  $$update public.tasks set workflow_key = 'contract_collect_documents'
    where transaction_id = 'f0400000-0000-4000-8000-000000000030'
      and workflow_key = 'contract_confirm_financing'$$,
  '23514', 'Workflow task identity is immutable',
  'workflow_key cannot be changed after creation'
);

update public.tasks set status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000030'
  and workflow_key like 'contract\_%' escape '\';
select lives_ok(
  $$select public.confirm_contract_signing('f0400000-0000-4000-8000-000000000030')$$,
  'Renamed required tasks still satisfy the contract milestone by key'
);
select lives_ok(
  $$select public.confirm_contract_signing('f0400000-0000-4000-8000-000000000030')$$,
  'Repeating contract signing is an idempotent success'
);
select is(
  (select count(*)::integer from public.tasks where transaction_id = 'f0400000-0000-4000-8000-000000000030' and workflow_key like 'closing\_%' escape '\'),
  5,
  'Repeated contract signing leaves exactly five keyed closing tasks'
);

-- A cancelled required task and a completed manual same-title task do not pass.
update public.tasks set status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000031'
  and workflow_key <> 'contract_book_signing';
update public.tasks set status = 'cancelled', completed_at = null
where transaction_id = 'f0400000-0000-4000-8000-000000000031'
  and workflow_key = 'contract_book_signing';
insert into public.tasks (
  organization_id, transaction_id, assigned_to, title, status, visibility, created_by, completed_at
) values (
  'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000031',
  'f0400000-0000-4000-8000-000000000001', 'Bóka undirritun', 'completed', 'internal',
  'f0400000-0000-4000-8000-000000000001', now()
);
select throws_ok(
  $$select public.confirm_contract_signing('f0400000-0000-4000-8000-000000000031')$$,
  '23514', 'Contract preparation is incomplete',
  'Five of six semantic keys plus a same-title manual task cannot pass the gate'
);
select is(
  (select stage::text from public.transactions where id = 'f0400000-0000-4000-8000-000000000031'),
  'contract',
  'Cancelling a required workflow task keeps the milestone incomplete'
);

-- Deleting a required row does not silently remove the semantic requirement.
delete from public.tasks
where transaction_id = 'f0400000-0000-4000-8000-000000000032'
  and workflow_key = 'contract_collect_documents';
update public.tasks set status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000032';
insert into public.tasks (
  organization_id, transaction_id, assigned_to, title, status, visibility, created_by, completed_at
) values (
  'f0400000-0000-4000-8000-000000000010', 'f0400000-0000-4000-8000-000000000032',
  'f0400000-0000-4000-8000-000000000001', 'Safna nauðsynlegum skjölum', 'completed', 'internal',
  'f0400000-0000-4000-8000-000000000001', now()
);
select throws_ok(
  $$select public.confirm_contract_signing('f0400000-0000-4000-8000-000000000032')$$,
  '23514', 'Contract preparation is incomplete',
  'Deleting a required keyed task cannot bypass the milestone'
);

-- Closing is also keyed; title changes are harmless and cancelled keys fail.
update public.tasks set title = 'Sérsniðin lokayfirferð', status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000030'
  and workflow_key = 'closing_prepare_final_documents';
update public.tasks set status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000030'
  and workflow_key like 'closing\_%' escape '\'
  and workflow_key <> 'closing_confirm_handover_time';
update public.tasks set status = 'cancelled', completed_at = null
where transaction_id = 'f0400000-0000-4000-8000-000000000030'
  and workflow_key = 'closing_confirm_handover_time';
select throws_ok(
  $$select public.confirm_transaction_ready_for_handover('f0400000-0000-4000-8000-000000000030')$$,
  '23514', 'Closing checklist is incomplete',
  'Four of five completed closing keys cannot advance'
);
update public.tasks set status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000030'
  and workflow_key = 'closing_confirm_handover_time';
select lives_ok(
  $$select public.confirm_transaction_ready_for_handover('f0400000-0000-4000-8000-000000000030')$$,
  'All five closing keys advance the transaction'
);
select lives_ok(
  $$select public.confirm_transaction_ready_for_handover('f0400000-0000-4000-8000-000000000030')$$,
  'Repeating handover readiness is an idempotent success'
);
select is(
  (select count(*)::integer from public.tasks where transaction_id = 'f0400000-0000-4000-8000-000000000030' and workflow_key like 'handover\_%' escape '\'),
  5,
  'Repeated handover initialization leaves exactly five stable keys'
);

-- Handover completion requires all five machine identities.
update public.tasks set status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000030'
  and workflow_key like 'handover\_%' escape '\'
  and workflow_key <> 'handover_record_handover';
select throws_ok(
  $$select public.confirm_transaction_completion('f0400000-0000-4000-8000-000000000030')$$,
  '23514', 'Handover checklist is incomplete',
  'Four of five completed handover keys cannot complete the transaction'
);
update public.tasks set status = 'completed', completed_at = now()
where transaction_id = 'f0400000-0000-4000-8000-000000000030'
  and workflow_key = 'handover_record_handover';
select lives_ok(
  $$select public.confirm_transaction_completion('f0400000-0000-4000-8000-000000000030')$$,
  'All five handover keys complete the transaction'
);

select lives_ok(
  $$select public.confirm_transaction_completion('f0400000-0000-4000-8000-000000000030')$$,
  'Repeating the final milestone is an idempotent success'
);
select is(
  (select count(*)::integer from public.transaction_stage_history
   where transaction_id = 'f0400000-0000-4000-8000-000000000030' and from_stage = 'handover' and to_stage = 'completed'),
  1,
  'Repeated completion does not duplicate stage history'
);
select is(
  (select count(*)::integer from public.activity_events
   where transaction_id = 'f0400000-0000-4000-8000-000000000030' and event_type = 'transaction_completed'),
  1,
  'Repeated completion does not duplicate activity'
);
select is(
  (select count(*)::integer from public.tasks
   where transaction_id = 'f0400000-0000-4000-8000-000000000030' and workflow_key like 'handover\_%' escape '\'),
  5,
  'Repeated milestones do not duplicate generated tasks'
);

select throws_ok(
  $$select public.confirm_contract_signing('f0400000-0000-4000-8000-000000000033')$$,
  '42501', 'Not authorized',
  'Cross-organization milestone execution remains denied'
);
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.confirm_contract_signing('f0400000-0000-4000-8000-000000000030')$$,
  '28000', 'Authentication required',
  'Unauthenticated behavior remains unchanged'
);

select * from finish();
rollback;
