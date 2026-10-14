begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'f0100000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'early-a@test.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Early Agent A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0100000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'early-b@test.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Early Agent B"}', now(), now(), '', '', '', '');

insert into public.organizations (id, name) values
  ('f0100000-0000-4000-8000-000000000010', 'Early lifecycle A'),
  ('f0100000-0000-4000-8000-000000000011', 'Early lifecycle B');
insert into public.organization_memberships (organization_id, user_id, role, is_active) values
  ('f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000001', 'admin', true),
  ('f0100000-0000-4000-8000-000000000011', 'f0100000-0000-4000-8000-000000000002', 'admin', true);

insert into public.properties (
  id, organization_id, slug, address_line, postal_code, municipality,
  property_type, size_sqm, room_count, year_built
) values
  ('f0100000-0000-4000-8000-000000000020', 'f0100000-0000-4000-8000-000000000010', 'early-valuation', 'Ferligata 1', '101', 'Reykjavík', null, null, null, null),
  ('f0100000-0000-4000-8000-000000000021', 'f0100000-0000-4000-8000-000000000010', 'early-not-ready', 'Ferligata 2', '101', 'Reykjavík', null, null, null, null),
  ('f0100000-0000-4000-8000-000000000022', 'f0100000-0000-4000-8000-000000000010', 'early-ready', 'Ferligata 3', '101', 'Reykjavík', 'apartment', 90, 4, 2020),
  ('f0100000-0000-4000-8000-000000000023', 'f0100000-0000-4000-8000-000000000010', 'early-listed', 'Ferligata 4', '101', 'Reykjavík', 'apartment', 80, 3, 2019),
  ('f0100000-0000-4000-8000-000000000024', 'f0100000-0000-4000-8000-000000000010', 'early-viewings', 'Ferligata 5', '101', 'Reykjavík', 'apartment', 85, 3, 2018),
  ('f0100000-0000-4000-8000-000000000025', 'f0100000-0000-4000-8000-000000000010', 'early-completed', 'Ferligata 6', '101', 'Reykjavík', 'apartment', 85, 3, 2018),
  ('f0100000-0000-4000-8000-000000000026', 'f0100000-0000-4000-8000-000000000011', 'early-other', 'Ferligata 7', '101', 'Reykjavík', null, null, null, null);

insert into public.transactions (
  id, organization_id, property_id, assigned_agent_id, stage, created_by,
  listing_title, listing_description, listing_documents_ready
) values
  ('f0100000-0000-4000-8000-000000000030', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000020', 'f0100000-0000-4000-8000-000000000001', 'valuation', 'f0100000-0000-4000-8000-000000000001', null, null, false),
  ('f0100000-0000-4000-8000-000000000031', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000021', 'f0100000-0000-4000-8000-000000000001', 'preparation', 'f0100000-0000-4000-8000-000000000001', null, null, false),
  ('f0100000-0000-4000-8000-000000000032', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000022', 'f0100000-0000-4000-8000-000000000001', 'preparation', 'f0100000-0000-4000-8000-000000000001', 'Björt og vel skipulögð íbúð', 'Vönduð eign með góðu skipulagi og björtum rýmum.', true),
  ('f0100000-0000-4000-8000-000000000033', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000023', 'f0100000-0000-4000-8000-000000000001', 'listed', 'f0100000-0000-4000-8000-000000000001', null, null, false),
  ('f0100000-0000-4000-8000-000000000034', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000024', 'f0100000-0000-4000-8000-000000000001', 'viewings', 'f0100000-0000-4000-8000-000000000001', null, null, false),
  ('f0100000-0000-4000-8000-000000000035', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000025', 'f0100000-0000-4000-8000-000000000001', 'completed', 'f0100000-0000-4000-8000-000000000001', null, null, false),
  ('f0100000-0000-4000-8000-000000000036', 'f0100000-0000-4000-8000-000000000011', 'f0100000-0000-4000-8000-000000000026', 'f0100000-0000-4000-8000-000000000002', 'valuation', 'f0100000-0000-4000-8000-000000000002', null, null, false);

insert into public.transaction_assignments (organization_id, transaction_id, user_id, role)
select organization_id, id, assigned_agent_id, 'primary_agent'::public.transaction_assignment_role
from public.transactions
where id::text like 'f0100000-%'
  and stage not in ('completed', 'cancelled');

insert into public.contacts (id, organization_id, full_name, created_by) values
  ('f0100000-0000-4000-8000-000000000040', 'f0100000-0000-4000-8000-000000000010', 'Seljandi Prófun', 'f0100000-0000-4000-8000-000000000001'),
  ('f0100000-0000-4000-8000-000000000041', 'f0100000-0000-4000-8000-000000000010', 'Kaupandi Prófun', 'f0100000-0000-4000-8000-000000000001');
insert into public.property_images (
  id, organization_id, property_id, storage_path, file_name, mime_type,
  file_size_bytes, uploaded_by
) values (
  'f0100000-0000-4000-8000-000000000050', 'f0100000-0000-4000-8000-000000000010',
  'f0100000-0000-4000-8000-000000000022', 'early/ready/photo.jpg', 'photo.jpg',
  'image/jpeg', 1024, 'f0100000-0000-4000-8000-000000000001'
);
insert into public.seller_listing_responses (
  id, organization_id, transaction_id, seller_contact_id, seller_user_id,
  response_type, listing_revision
) values (
  'f0100000-0000-4000-8000-000000000051', 'f0100000-0000-4000-8000-000000000010',
  'f0100000-0000-4000-8000-000000000032', 'f0100000-0000-4000-8000-000000000040',
  'f0100000-0000-4000-8000-000000000001', 'approved', 1
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0100000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.start_listing_preparation('f0100000-0000-4000-8000-000000000030')$$,
  'Valuation can move to preparation through its dedicated operation'
);
select is((select stage::text from public.transactions where id = 'f0100000-0000-4000-8000-000000000030'), 'preparation', 'Valuation transition persisted');
select lives_ok(
  $$select public.start_listing_preparation('f0100000-0000-4000-8000-000000000030')$$,
  'Repeated valuation transition is idempotent'
);
select is(
  (select count(*)::integer from public.transaction_stage_history where transaction_id = 'f0100000-0000-4000-8000-000000000030' and to_stage = 'preparation'),
  1, 'Repeated valuation transition does not duplicate history'
);
select throws_ok(
  $$select public.advance_transaction_stage('f0100000-0000-4000-8000-000000000031', 'listed', null)$$,
  '23514', 'Þessi stöðubreyting krefst sérstaks vinnuferlis í Kelvo',
  'The generic stage setter cannot bypass listing readiness'
);
select throws_ok(
  $$select public.activate_property_listing('f0100000-0000-4000-8000-000000000031')$$,
  '23514', 'Skráningin uppfyllir ekki öll skilyrði fyrir sölu',
  'Preparation cannot become listed before readiness'
);
select lives_ok(
  $$select public.mark_listing_ready_for_publish('f0100000-0000-4000-8000-000000000032')$$,
  'A complete listing can be marked ready'
);
select lives_ok(
  $$select public.activate_property_listing('f0100000-0000-4000-8000-000000000032')$$,
  'A ready preparation can become listed'
);
select is((select stage::text from public.transactions where id = 'f0100000-0000-4000-8000-000000000032'), 'listed', 'Listing activation persisted');
select lives_ok(
  $$select public.activate_property_listing('f0100000-0000-4000-8000-000000000032')$$,
  'Repeated listing activation is idempotent'
);
select is(
  (select count(*)::integer from public.transaction_stage_history where transaction_id = 'f0100000-0000-4000-8000-000000000032' and to_stage = 'listed'),
  1, 'Repeated listing activation does not duplicate history'
);

select lives_ok(
  $$select public.create_viewing('f0100000-0000-4000-8000-000000000033', 'open_house', now() + interval '1 day', now() + interval '1 day 1 hour')$$,
  'A listed transaction can schedule a viewing'
);
select is((select stage::text from public.transactions where id = 'f0100000-0000-4000-8000-000000000033'), 'viewings', 'First scheduled viewing advances listed to viewings');
select lives_ok(
  $$select public.create_viewing('f0100000-0000-4000-8000-000000000033', 'private', now() + interval '2 days', now() + interval '2 days 1 hour')$$,
  'Additional viewing scheduling remains valid in the viewings stage'
);
select is(
  (select count(*)::integer from public.transaction_stage_history where transaction_id = 'f0100000-0000-4000-8000-000000000033' and to_stage = 'viewings'),
  1, 'Additional viewings do not duplicate stage history'
);
select throws_ok(
  $$select public.create_viewing('f0100000-0000-4000-8000-000000000031', 'private', now() + interval '1 day', now() + interval '1 day 1 hour')$$,
  '23514', 'Ekki er hægt að skrá skoðun á þessu stigi viðskipta',
  'An invalid transaction stage cannot schedule a viewing'
);

insert into public.offers (
  id, organization_id, transaction_id, buyer_contact_id, amount_isk,
  valid_until, requested_handover_date, status, created_by
) values
  ('f0100000-0000-4000-8000-000000000060', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000034', 'f0100000-0000-4000-8000-000000000041', 70000000, now() + interval '2 days', current_date + 30, 'draft', 'f0100000-0000-4000-8000-000000000001'),
  ('f0100000-0000-4000-8000-000000000061', 'f0100000-0000-4000-8000-000000000010', 'f0100000-0000-4000-8000-000000000034', 'f0100000-0000-4000-8000-000000000041', 71000000, now() + interval '2 days', current_date + 30, 'draft', 'f0100000-0000-4000-8000-000000000001');
select is((select stage::text from public.transactions where id = 'f0100000-0000-4000-8000-000000000034'), 'viewings', 'Creating a draft offer does not advance the transaction');
select lives_ok($$select public.submit_offer('f0100000-0000-4000-8000-000000000060')$$, 'The first genuine offer can be submitted');
select is((select stage::text from public.transactions where id = 'f0100000-0000-4000-8000-000000000034'), 'offers', 'First submitted offer advances viewings to offers');
select lives_ok($$select public.submit_offer('f0100000-0000-4000-8000-000000000061')$$, 'Additional submitted offers remain valid');
select is(
  (select count(*)::integer from public.transaction_stage_history where transaction_id = 'f0100000-0000-4000-8000-000000000034' and to_stage = 'offers'),
  1, 'Additional offers do not duplicate stage history'
);
select throws_ok(
  $$select public.start_listing_preparation('f0100000-0000-4000-8000-000000000035')$$,
  '23514', 'Loknum eða niðurfelldum viðskiptum má ekki breyta',
  'Completed transactions remain immutable'
);

select set_config('request.jwt.claim.sub', 'f0100000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.start_listing_preparation('f0100000-0000-4000-8000-000000000030')$$,
  '42501', 'Þú hefur ekki heimild til að hefja undirbúning',
  'Cross-organization transition remains denied'
);

select * from finish();
rollback;
