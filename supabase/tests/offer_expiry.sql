begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

-- Self-contained rollback-only fixture; no demo users or seeded rows are required.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'f0300000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'offer-expiry-agent@test.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Expiry Agent"}',
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f0300000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'offer-expiry-seller@test.invalid', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Expiry Seller","account_type":"customer"}',
    now(), now(), '', '', '', ''
  );

insert into public.organizations (id, name)
values ('f0300000-0000-4000-8000-000000000010', 'Offer expiry test');

insert into public.organization_memberships (organization_id, user_id, role, is_active)
values (
  'f0300000-0000-4000-8000-000000000010',
  'f0300000-0000-4000-8000-000000000001',
  'admin', true
);

insert into public.properties (
  id, organization_id, slug, address_line, postal_code, municipality
) values (
  'f0300000-0000-4000-8000-000000000020',
  'f0300000-0000-4000-8000-000000000010',
  'offer-expiry-test', 'Expiry gata 1', '101', 'Reykjavík'
);

insert into public.transactions (
  id, organization_id, property_id, assigned_agent_id, stage, created_by
) values (
  'f0300000-0000-4000-8000-000000000030',
  'f0300000-0000-4000-8000-000000000010',
  'f0300000-0000-4000-8000-000000000020',
  'f0300000-0000-4000-8000-000000000001',
  'offers',
  'f0300000-0000-4000-8000-000000000001'
);

insert into public.transaction_assignments (organization_id, transaction_id, user_id, role)
values (
  'f0300000-0000-4000-8000-000000000010',
  'f0300000-0000-4000-8000-000000000030',
  'f0300000-0000-4000-8000-000000000001',
  'primary_agent'
);

insert into public.contacts (id, organization_id, full_name, created_by)
values
  (
    'f0300000-0000-4000-8000-000000000040',
    'f0300000-0000-4000-8000-000000000010',
    'Expiry Buyer', 'f0300000-0000-4000-8000-000000000001'
  ),
  (
    'f0300000-0000-4000-8000-000000000041',
    'f0300000-0000-4000-8000-000000000010',
    'Expiry Seller', 'f0300000-0000-4000-8000-000000000001'
  );

insert into public.transaction_parties (
  organization_id, transaction_id, contact_id, role, is_primary
) values (
  'f0300000-0000-4000-8000-000000000010',
  'f0300000-0000-4000-8000-000000000030',
  'f0300000-0000-4000-8000-000000000041',
  'seller',
  true
);

insert into public.portal_access_grants (
  organization_id, transaction_id, user_id, contact_id, role, status,
  created_by, activated_at
) values (
  'f0300000-0000-4000-8000-000000000010',
  'f0300000-0000-4000-8000-000000000030',
  'f0300000-0000-4000-8000-000000000002',
  'f0300000-0000-4000-8000-000000000041',
  'seller', 'active',
  'f0300000-0000-4000-8000-000000000001', now()
);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'f0300000-0000-4000-8000-000000000001', true);

-- One genuinely live offer, plus open offers that expire after this transaction began.
insert into public.offers (
  id, organization_id, transaction_id, buyer_contact_id, amount_isk,
  valid_until, requested_handover_date, status, sent_to_seller_at, created_by
) values
  ('f0300000-0000-4000-8000-000000000101', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() + interval '1 hour', current_date + 30, 'draft', null, 'f0300000-0000-4000-8000-000000000001'),
  ('f0300000-0000-4000-8000-000000000102', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() + interval '250 milliseconds', current_date + 30, 'draft', null, 'f0300000-0000-4000-8000-000000000001'),
  ('f0300000-0000-4000-8000-000000000103', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() + interval '250 milliseconds', current_date + 30, 'submitted', null, 'f0300000-0000-4000-8000-000000000001'),
  ('f0300000-0000-4000-8000-000000000104', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() + interval '250 milliseconds', current_date + 30, 'agent_approved', null, 'f0300000-0000-4000-8000-000000000001'),
  ('f0300000-0000-4000-8000-000000000105', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() + interval '250 milliseconds', current_date + 30, 'sent_to_seller', clock_timestamp(), 'f0300000-0000-4000-8000-000000000001'),
  ('f0300000-0000-4000-8000-000000000106', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() + interval '250 milliseconds', current_date + 30, 'sent_to_seller', clock_timestamp(), 'f0300000-0000-4000-8000-000000000001'),
  ('f0300000-0000-4000-8000-000000000107', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() + interval '250 milliseconds', current_date + 30, 'seller_intent_recorded', clock_timestamp(), 'f0300000-0000-4000-8000-000000000001'),
  ('f0300000-0000-4000-8000-000000000108', 'f0300000-0000-4000-8000-000000000010', 'f0300000-0000-4000-8000-000000000030', 'f0300000-0000-4000-8000-000000000040', 80000000, clock_timestamp() - interval '1 day', current_date + 30, 'accepted', clock_timestamp(), 'f0300000-0000-4000-8000-000000000001');

insert into public.seller_offer_responses (
  organization_id, offer_id, seller_contact_id, intent, submitted_by
) values (
  'f0300000-0000-4000-8000-000000000010',
  'f0300000-0000-4000-8000-000000000107',
  'f0300000-0000-4000-8000-000000000041',
  'accept',
  'f0300000-0000-4000-8000-000000000002'
);

-- By the time mutations run, these offers are at least one second past validity.
select pg_sleep(1.3);

select lives_ok(
  $$select public.submit_offer('f0300000-0000-4000-8000-000000000101')$$,
  'A live offer can progress'
);
select is(
  (select status::text from public.offers where id = 'f0300000-0000-4000-8000-000000000101'),
  'submitted',
  'The live offer reached the expected state'
);
select throws_ok(
  $$select public.submit_offer('f0300000-0000-4000-8000-000000000102')$$,
  '23514', 'Offer validity has expired',
  'An offer past valid_until cannot be submitted'
);
select throws_ok(
  $$select public.approve_offer_for_seller('f0300000-0000-4000-8000-000000000103')$$,
  '23514', 'Offer validity has expired',
  'An expired offer cannot be agent approved'
);
select throws_ok(
  $$select public.request_offer_change('f0300000-0000-4000-8000-000000000103', 'Test')$$,
  '23514', 'Offer validity has expired',
  'An expired offer cannot move to change requested'
);
select throws_ok(
  $$select public.send_offer_to_seller('f0300000-0000-4000-8000-000000000104')$$,
  '23514', 'Offer validity has expired',
  'An expired offer cannot be sent to the seller'
);
select throws_ok(
  $$select public.record_seller_offer_intent('f0300000-0000-4000-8000-000000000105', 'f0300000-0000-4000-8000-000000000041', 'accept')$$,
  '23514', 'Offer validity has expired',
  'An expired offer cannot receive an internal seller intent'
);

select set_config('request.jwt.claim.sub', 'f0300000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$select public.record_customer_seller_offer_intent('f0300000-0000-4000-8000-000000000106', 'accept')$$,
  '23514', 'Offer validity has expired',
  'An expired offer cannot receive a customer seller response'
);

select set_config('request.jwt.claim.sub', 'f0300000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.confirm_offer_outcome('f0300000-0000-4000-8000-000000000107', 'accepted', null)$$,
  '23514', 'Offer validity has expired',
  'An expired offer cannot be accepted'
);
select is(
  private.effective_offer_status(
    (select status from public.offers where id = 'f0300000-0000-4000-8000-000000000108'),
    (select valid_until from public.offers where id = 'f0300000-0000-4000-8000-000000000108')
  )::text,
  'accepted',
  'An accepted historical offer is not reclassified as expired'
);
select is(
  private.effective_offer_status(
    (select status from public.offers where id = 'f0300000-0000-4000-8000-000000000102'),
    (select valid_until from public.offers where id = 'f0300000-0000-4000-8000-000000000102')
  )::text,
  'expired',
  'Expiry is derived deterministically for reads'
);

-- The test transaction started before the short validity window. This proves the
-- guard uses wall-clock time rather than transaction-start now().
select set_config('request.jwt.claim.sub', 'f0300000-0000-4000-8000-ffffffffffff', true);
select throws_ok(
  $$select public.approve_offer_for_seller('f0300000-0000-4000-8000-000000000103')$$,
  '42501', 'Not authorized',
  'Authorization remains authoritative before expiry disclosure'
);

select * from finish();
rollback;
