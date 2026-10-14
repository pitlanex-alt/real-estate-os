begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(29);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'f1400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'guard-agent-a@test.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Guard Agent A"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f1400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'guard-agent-b@test.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Guard Agent B"}',
    now(), now(), '', '', '', ''
  );

insert into public.organizations (id, name) values
  ('f1400000-0000-4000-8000-000000000010', 'Guard test A'),
  ('f1400000-0000-4000-8000-000000000011', 'Guard test B');

insert into public.organization_memberships (organization_id, user_id, role, is_active) values
  ('f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000001', 'admin', true),
  ('f1400000-0000-4000-8000-000000000011', 'f1400000-0000-4000-8000-000000000002', 'admin', true);

insert into public.properties (id, organization_id, slug, address_line, postal_code, municipality) values
  ('f1400000-0000-4000-8000-000000000020', 'f1400000-0000-4000-8000-000000000010', 'guard-forward', 'Varðgata 1', '101', 'Reykjavík'),
  ('f1400000-0000-4000-8000-000000000021', 'f1400000-0000-4000-8000-000000000010', 'guard-main', 'Varðgata 2', '101', 'Reykjavík'),
  ('f1400000-0000-4000-8000-000000000022', 'f1400000-0000-4000-8000-000000000010', 'guard-completed', 'Varðgata 3', '101', 'Reykjavík'),
  ('f1400000-0000-4000-8000-000000000023', 'f1400000-0000-4000-8000-000000000010', 'guard-cancelled', 'Varðgata 4', '101', 'Reykjavík'),
  ('f1400000-0000-4000-8000-000000000024', 'f1400000-0000-4000-8000-000000000011', 'guard-other-org', 'Varðgata 5', '101', 'Reykjavík');

insert into public.transactions (
  id, organization_id, property_id, assigned_agent_id, stage, created_by
) values
  ('f1400000-0000-4000-8000-000000000030', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000020', 'f1400000-0000-4000-8000-000000000001', 'valuation', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000031', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000021', 'f1400000-0000-4000-8000-000000000001', 'listed', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000032', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000022', 'f1400000-0000-4000-8000-000000000001', 'listed', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000033', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000023', 'f1400000-0000-4000-8000-000000000001', 'listed', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000034', 'f1400000-0000-4000-8000-000000000011', 'f1400000-0000-4000-8000-000000000024', 'f1400000-0000-4000-8000-000000000002', 'listed', 'f1400000-0000-4000-8000-000000000002');

insert into public.transaction_assignments (organization_id, transaction_id, user_id, role) values
  ('f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000030', 'f1400000-0000-4000-8000-000000000001', 'primary_agent'),
  ('f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000031', 'f1400000-0000-4000-8000-000000000001', 'primary_agent'),
  ('f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000032', 'f1400000-0000-4000-8000-000000000001', 'primary_agent'),
  ('f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000033', 'f1400000-0000-4000-8000-000000000001', 'primary_agent'),
  ('f1400000-0000-4000-8000-000000000011', 'f1400000-0000-4000-8000-000000000034', 'f1400000-0000-4000-8000-000000000002', 'primary_agent');

insert into public.contacts (id, organization_id, full_name, created_by) values
  ('f1400000-0000-4000-8000-000000000040', 'f1400000-0000-4000-8000-000000000010', 'Skoðunargestur A', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000041', 'f1400000-0000-4000-8000-000000000010', 'Skoðunargestur B', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000042', 'f1400000-0000-4000-8000-000000000010', 'Skoðunargestur C', 'f1400000-0000-4000-8000-000000000001');

insert into public.viewings (
  id, organization_id, transaction_id, viewing_type, starts_at, ends_at, status, created_by
) values
  ('f1400000-0000-4000-8000-000000000050', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000031', 'private', now() + interval '1 hour', now() + interval '2 hours', 'scheduled', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000051', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000031', 'private', now() - interval '2 hours', now() - interval '1 hour', 'scheduled', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000052', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000031', 'private', now() + interval '3 hours', now() + interval '4 hours', 'scheduled', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000053', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000032', 'private', now() + interval '1 hour', now() + interval '2 hours', 'scheduled', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000054', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000033', 'private', now() + interval '1 hour', now() + interval '2 hours', 'scheduled', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000055', 'f1400000-0000-4000-8000-000000000011', 'f1400000-0000-4000-8000-000000000034', 'private', now() + interval '1 hour', now() + interval '2 hours', 'scheduled', 'f1400000-0000-4000-8000-000000000002');

insert into public.viewing_guests (
  id, organization_id, viewing_id, contact_id, created_by
) values
  ('f1400000-0000-4000-8000-000000000060', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000050', 'f1400000-0000-4000-8000-000000000040', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000061', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000051', 'f1400000-0000-4000-8000-000000000041', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000062', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000052', 'f1400000-0000-4000-8000-000000000042', 'f1400000-0000-4000-8000-000000000001');

insert into public.tasks (
  id, organization_id, transaction_id, title, created_by
) values
  ('f1400000-0000-4000-8000-000000000070', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000032', 'Sögulegt verkefni', 'f1400000-0000-4000-8000-000000000001'),
  ('f1400000-0000-4000-8000-000000000071', 'f1400000-0000-4000-8000-000000000010', 'f1400000-0000-4000-8000-000000000033', 'Niðurfellt verkefni', 'f1400000-0000-4000-8000-000000000001');

insert into public.documents (
  id, organization_id, transaction_id, storage_path, title, document_type, uploaded_by
) values (
  'f1400000-0000-4000-8000-000000000080', 'f1400000-0000-4000-8000-000000000010',
  'f1400000-0000-4000-8000-000000000032', 'guard/history.pdf', 'Sögulegt skjal',
  'Annað', 'f1400000-0000-4000-8000-000000000001'
);

insert into public.offers (
  id, organization_id, transaction_id, buyer_contact_id, amount_isk,
  valid_until, requested_handover_date, status, created_by
) values (
  'f1400000-0000-4000-8000-000000000081', 'f1400000-0000-4000-8000-000000000010',
  'f1400000-0000-4000-8000-000000000032', 'f1400000-0000-4000-8000-000000000040',
  80000000, now() + interval '1 day', current_date + 30, 'draft',
  'f1400000-0000-4000-8000-000000000001'
);

-- Turn two transactions into immutable history after their child fixtures exist.
update public.transactions set stage = 'contract' where id = 'f1400000-0000-4000-8000-000000000032';
update public.transactions set stage = 'closing' where id = 'f1400000-0000-4000-8000-000000000032';
update public.transactions set stage = 'handover' where id = 'f1400000-0000-4000-8000-000000000032';
update public.transactions set stage = 'completed', completed_at = now() where id = 'f1400000-0000-4000-8000-000000000032';
update public.transactions set stage = 'cancelled' where id = 'f1400000-0000-4000-8000-000000000033';

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f1400000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.start_listing_preparation('f1400000-0000-4000-8000-000000000030')$$,
  'Supported forward transaction progression still works'
);
select throws_ok(
  $$select public.advance_transaction_stage('f1400000-0000-4000-8000-000000000030', 'valuation', null)$$,
  '23514', 'Þessi stöðubreyting krefst sérstaks vinnuferlis í Kelvo',
  'Unsupported backward progression is rejected'
);
select throws_ok(
  $$update public.transactions set stage = 'preparation'
    where id = 'f1400000-0000-4000-8000-000000000031'$$,
  '23514', 'Óstudd breyting á stöðu viðskipta',
  'The table boundary also rejects a direct stage regression'
);
select throws_ok(
  $$update public.transactions set stage = 'handover' where id = 'f1400000-0000-4000-8000-000000000032'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Completed transaction cannot regress'
);
select throws_ok(
  $$update public.transactions set stage = 'listed' where id = 'f1400000-0000-4000-8000-000000000033'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Cancelled transaction cannot regress'
);
select throws_ok(
  $$update public.tasks set title = 'Breytt saga' where id = 'f1400000-0000-4000-8000-000000000070'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Completed transaction rejects task mutation'
);
select throws_ok(
  $$update public.tasks set title = 'Breytt niðurfelling' where id = 'f1400000-0000-4000-8000-000000000071'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Cancelled transaction rejects task mutation'
);
select throws_ok(
  $$delete from public.documents where id = 'f1400000-0000-4000-8000-000000000080'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Completed transaction rejects destructive document mutation'
);
select throws_ok(
  $$update public.offers set amount_isk = 81000000
    where id = 'f1400000-0000-4000-8000-000000000081'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Completed transaction rejects offer mutation'
);
select is(
  (select count(*)::integer from public.documents where id = 'f1400000-0000-4000-8000-000000000080'),
  1,
  'Historical documents remain readable after completion'
);

select lives_ok(
  $$select public.update_viewing_guest(
    'f1400000-0000-4000-8000-000000000060', 'attended', 'interested', 'Athugasemd', null, null
  )$$,
  'A scheduled operational viewing guest can be updated'
);
select throws_ok(
  $$select public.complete_viewing('f1400000-0000-4000-8000-000000000050', null)$$,
  '23514', 'Ekki er hægt að ljúka skoðun áður en henni lýkur',
  'A future viewing cannot be completed too early'
);
select lives_ok(
  $$select public.complete_viewing('f1400000-0000-4000-8000-000000000051', null)$$,
  'A viewing can be completed after its end time'
);
select throws_ok(
  $$select public.complete_viewing('f1400000-0000-4000-8000-000000000051', null)$$,
  '23514', 'Skoðuninni hefur þegar verið lokið',
  'A completed viewing cannot be completed twice'
);
select throws_ok(
  $$select public.cancel_viewing('f1400000-0000-4000-8000-000000000051', null)$$,
  '23514', 'Ekki er hægt að fella niður lokna skoðun',
  'A completed viewing cannot be cancelled'
);
select lives_ok(
  $$select public.cancel_viewing('f1400000-0000-4000-8000-000000000052', 'Skoðun felld niður í prófi')$$,
  'A scheduled viewing can be cancelled'
);
select lives_ok(
  $$select public.cancel_viewing('f1400000-0000-4000-8000-000000000052', 'Endurtekið kall')$$,
  'Repeated cancellation is an idempotent success'
);
select is(
  (select count(*)::integer from public.activity_events
   where event_type = 'viewing_cancelled'
     and metadata->>'viewing_id' = 'f1400000-0000-4000-8000-000000000052'),
  1,
  'Repeated cancellation creates one activity event'
);
select throws_ok(
  $$select public.complete_viewing('f1400000-0000-4000-8000-000000000052', null)$$,
  '23514', 'Ekki er hægt að ljúka niðurfelldri skoðun',
  'A cancelled viewing cannot be completed'
);
select throws_ok(
  $$update public.viewing_guests set internal_notes = 'Breytt eftir lokun'
    where id = 'f1400000-0000-4000-8000-000000000061'$$,
  '23514', 'Lokinni eða niðurfelldri skoðun má ekki breyta',
  'Completed viewing guest history is immutable'
);
select throws_ok(
  $$update public.viewing_guests set internal_notes = 'Breytt eftir niðurfellingu'
    where id = 'f1400000-0000-4000-8000-000000000062'$$,
  '23514', 'Lokinni eða niðurfelldri skoðun má ekki breyta',
  'Cancelled viewing guest history is immutable'
);
select throws_ok(
  $$update public.viewings set viewing_type = 'changed'
    where id = 'f1400000-0000-4000-8000-000000000053'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Completed parent transaction blocks viewing mutation'
);
select throws_ok(
  $$update public.viewings set viewing_type = 'changed'
    where id = 'f1400000-0000-4000-8000-000000000054'$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Cancelled parent transaction blocks viewing mutation'
);
select throws_ok(
  $$select public.create_viewing(
    'f1400000-0000-4000-8000-000000000032', 'private', now() + interval '1 day', now() + interval '1 day 1 hour'
  )$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'A completed transaction cannot receive a new viewing'
);
select throws_ok(
  $$select public.create_viewing(
    'f1400000-0000-4000-8000-000000000030', 'private', now() + interval '1 day', now() + interval '1 day 1 hour'
  )$$,
  '23514', 'Ekki er hægt að skrá skoðun á þessu stigi viðskipta',
  'Viewing creation is limited to appropriate transaction stages'
);
select throws_ok(
  $$select public.create_viewing(
    'f1400000-0000-4000-8000-000000000031', 'private', now() - interval '2 hours', now() - interval '1 hour'
  )$$,
  '23514', 'Ekki er hægt að stofna skoðun sem er þegar liðin',
  'A new scheduled viewing cannot already be past'
);

select set_config('request.jwt.claim.sub', 'f1400000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.cancel_viewing('f1400000-0000-4000-8000-000000000050', null)$$,
  '42501', 'Þú hefur ekki heimild til að fella niður skoðun',
  'Cross-organization viewing cancellation remains denied'
);
select throws_ok(
  $$select public.advance_transaction_stage('f1400000-0000-4000-8000-000000000031', 'viewings', null)$$,
  '42501', 'Þú hefur ekki heimild til að breyta stöðu viðskiptanna',
  'Cross-organization stage mutation remains denied'
);
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.cancel_viewing('f1400000-0000-4000-8000-000000000055', null)$$,
  '28000', 'Innskráningar er krafist',
  'Unauthenticated viewing mutation remains denied'
);

select * from finish();
rollback;
