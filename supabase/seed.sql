-- Development-only demo seed.
--
-- This script deliberately does not create an auth user or contain a password.
-- Create Sara, Anna, and Jón in Supabase Auth first using the development
-- emails sara@demo.is, anna@demo.is, and jon@demo.is.
-- This fixed email lookup is development-seed-only. Production onboarding will
-- create profile and organization membership data through the application workflow.
-- Then run this file again. It is idempotent for the fixed demo identifiers.

do $$
declare
  v_sara_id uuid;
  v_anna_id uuid;
  v_jon_id uuid;
  v_org_id constant uuid := '10000000-0000-4000-8000-000000000001';
begin
  select auth_user.id
  into v_sara_id
  from auth.users auth_user
  where lower(auth_user.email) = 'sara@demo.is'
  order by auth_user.created_at
  limit 1;

  if v_sara_id is null then
    raise notice 'Mó demo seed skipped: create the sara@demo.is Auth user, then rerun supabase/seed.sql.';
    return;
  end if;

  select auth_user.id into v_anna_id
  from auth.users auth_user
  where lower(auth_user.email) = 'anna@demo.is'
  order by auth_user.created_at limit 1;

  select auth_user.id into v_jon_id
  from auth.users auth_user
  where lower(auth_user.email) = 'jon@demo.is'
  order by auth_user.created_at limit 1;

  insert into public.profiles (id, display_name, professional_title, phone, email, account_type)
  values (v_sara_id, 'Sara Guðmundsdóttir', 'Fasteignasali', '555 0120', 'sara@demo.is', 'internal')
  on conflict (id) do update set
    display_name = excluded.display_name,
    professional_title = excluded.professional_title,
    phone = excluded.phone,
    email = excluded.email,
    account_type = excluded.account_type;

  insert into public.organizations (
    id, name, public_email, phone, website, address,
    default_contact_name, default_contact_email, default_contact_phone
  ) values (
    v_org_id, 'Mó Demo Fasteignasala', 'mottaka@demo.is', '555 0100',
    'https://demo.is', 'Laugavegur 1, 101 Reykjavík',
    'Sara Guðmundsdóttir', 'sara@demo.is', '555 0120'
  ) on conflict (id) do update set
    name = excluded.name,
    public_email = excluded.public_email,
    phone = excluded.phone,
    website = excluded.website,
    address = excluded.address,
    default_contact_name = excluded.default_contact_name,
    default_contact_email = excluded.default_contact_email,
    default_contact_phone = excluded.default_contact_phone;

  insert into public.organization_memberships (organization_id, user_id, role, is_active)
  values (v_org_id, v_sara_id, 'admin', true)
  on conflict (organization_id, user_id) do update
  set role = excluded.role, is_active = true;

  insert into public.properties (
    id, organization_id, slug, address_line, postal_code, municipality,
    registry_number, size_sqm, room_count, bedroom_count, year_built
  ) values
    ('20000000-0000-4000-8000-000000000001', v_org_id, 'laugavegur-120', 'Laugavegur 120', '101', 'Reykjavík', 'F1234567', 112, 4, 3, 2018),
    ('20000000-0000-4000-8000-000000000002', v_org_id, 'alfheimar-14', 'Álfheimar 14', '104', 'Reykjavík', null, null, null, null, null),
    ('20000000-0000-4000-8000-000000000003', v_org_id, 'hringbraut-76', 'Hringbraut 76', '107', 'Reykjavík', null, null, null, null, null),
    ('20000000-0000-4000-8000-000000000004', v_org_id, 'solvallagata-42', 'Sólvallagata 42', '101', 'Reykjavík', null, null, null, null, null)
  on conflict (id) do update set
    address_line = excluded.address_line,
    postal_code = excluded.postal_code,
    municipality = excluded.municipality,
    registry_number = excluded.registry_number,
    size_sqm = excluded.size_sqm,
    room_count = excluded.room_count,
    bedroom_count = excluded.bedroom_count,
    year_built = excluded.year_built;

  insert into public.contacts (
    id, organization_id, full_name, phone, email, created_by
  ) values
    ('30000000-0000-4000-8000-000000000001', v_org_id, 'Anna Jónsdóttir', '699 1234', 'anna@example.is', v_sara_id),
    ('30000000-0000-4000-8000-000000000002', v_org_id, 'Guðrún Ólafsdóttir', null, null, v_sara_id),
    ('30000000-0000-4000-8000-000000000003', v_org_id, 'Magnús Karlsson', null, null, v_sara_id),
    ('30000000-0000-4000-8000-000000000004', v_org_id, 'Katrín Magnúsdóttir', null, null, v_sara_id)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email;

  insert into public.transactions (
    id, organization_id, property_id, assigned_agent_id, stage,
    asking_price_isk, started_at, created_by
  ) values
    ('40000000-0000-4000-8000-000000000001', v_org_id, '20000000-0000-4000-8000-000000000001', v_sara_id, 'viewings', 84900000, now() - interval '30 days', v_sara_id),
    ('40000000-0000-4000-8000-000000000002', v_org_id, '20000000-0000-4000-8000-000000000002', v_sara_id, 'preparation', null, now() - interval '5 days', v_sara_id),
    ('40000000-0000-4000-8000-000000000003', v_org_id, '20000000-0000-4000-8000-000000000003', v_sara_id, 'listed', 72900000, now() - interval '21 days', v_sara_id),
    ('40000000-0000-4000-8000-000000000004', v_org_id, '20000000-0000-4000-8000-000000000004', v_sara_id, 'valuation', null, now(), v_sara_id)
  on conflict (id) do update set
    assigned_agent_id = excluded.assigned_agent_id,
    stage = excluded.stage,
    asking_price_isk = excluded.asking_price_isk;

  insert into public.transaction_assignments (organization_id, transaction_id, user_id, role)
  values
    (v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'primary_agent'),
    (v_org_id, '40000000-0000-4000-8000-000000000002', v_sara_id, 'primary_agent'),
    (v_org_id, '40000000-0000-4000-8000-000000000003', v_sara_id, 'primary_agent'),
    (v_org_id, '40000000-0000-4000-8000-000000000004', v_sara_id, 'primary_agent')
  on conflict (transaction_id, user_id, role) do nothing;

  insert into public.transaction_parties (
    id, organization_id, transaction_id, contact_id, role, is_primary
  ) values
    ('50000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'seller', true),
    ('50000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'seller', true),
    ('50000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 'seller', true),
    ('50000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 'seller', true)
  on conflict (id) do update set contact_id = excluded.contact_id;

  insert into public.transaction_stage_history (
    id, organization_id, transaction_id, from_stage, to_stage, changed_by, reason
  ) values
    ('60000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', null, 'viewings', v_sara_id, 'Demo seed'),
    ('60000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000002', null, 'preparation', v_sara_id, 'Demo seed'),
    ('60000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000003', null, 'listed', v_sara_id, 'Demo seed'),
    ('60000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000004', null, 'valuation', v_sara_id, 'Demo seed')
  on conflict (id) do nothing;

  insert into public.activity_events (
    id, organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary
  ) values
    ('70000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'next_action', 'internal', 'Tilboð bíður yfirferðar'),
    ('70000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000002', v_sara_id, 'next_action', 'internal', 'Vantar eignaskrá'),
    ('70000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000003', v_sara_id, 'next_action', 'internal', 'Skoðun á laugardag'),
    ('70000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000004', v_sara_id, 'next_action', 'internal', 'Verðmat í dag kl. 13:00')
  on conflict (id) do update set summary = excluded.summary;

  insert into public.contacts (
    id, organization_id, full_name, phone, email, created_by
  ) values
    ('31000000-0000-4000-8000-000000000001', v_org_id, 'Jón Jónsson', '555 0101', 'jon@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000002', v_org_id, 'Sara Magnúsdóttir', '555 0102', 'sara.m@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000003', v_org_id, 'Pétur Karlsson', '555 0103', 'petur.k@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000004', v_org_id, 'Elín Guðmundsdóttir', '555 0104', 'elin.g@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000005', v_org_id, 'Guðmundur Ari Sigurðsson', '555 0105', 'gudmundur@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000006', v_org_id, 'Ragna Björnsdóttir', '555 0106', 'ragna@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000007', v_org_id, 'Viktor Ólafsson', '555 0107', 'viktor@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000008', v_org_id, 'Helga María Eiríksdóttir', '555 0108', 'helga.maria@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000009', v_org_id, 'Ólafur Gunnarsson', '555 0109', 'olafur.g@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000010', v_org_id, 'Karen Þorvaldsdóttir', '555 0110', 'karen@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000011', v_org_id, 'Bjarni Hólm', '555 0111', 'bjarni@example.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000012', v_org_id, 'Sigríður Anna Jónsdóttir', '555 0112', 'sigridur@example.is', v_sara_id)
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email;

  insert into public.viewings (
    id, organization_id, transaction_id, viewing_type, starts_at, ends_at,
    status, created_by, completed_at
  ) values (
    '80000000-0000-4000-8000-000000000001',
    v_org_id,
    '40000000-0000-4000-8000-000000000001',
    'open_house',
    '2026-10-02 17:30:00+00',
    '2026-10-02 18:15:00+00',
    'active',
    v_sara_id,
    null
  )
  on conflict (id) do update set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    completed_at = excluded.completed_at;

  insert into public.viewing_guests (
    id, organization_id, viewing_id, contact_id, attendance, interest,
    internal_notes, next_action, follow_up_due_at, is_walk_in, created_by
  ) values
    ('81000000-0000-4000-8000-000000000001', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'attended', 'very_interested', 'Vill fá nánari upplýsingar um afhendingu.', 'today', '2026-10-03 12:00:00+00', false, v_sara_id),
    ('81000000-0000-4000-8000-000000000002', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 'attended', 'interested', 'Óskar eftir annarri skoðun.', 'second-viewing', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000003', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', 'attended', 'interested', 'Fjármögnun ekki staðfest.', 'today', '2026-10-03 12:00:00+00', false, v_sara_id),
    ('81000000-0000-4000-8000-000000000004', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000004', 'attended', 'unsure', 'Vill ræða verð við maka.', 'tomorrow', '2026-10-04 12:00:00+00', false, v_sara_id),
    ('81000000-0000-4000-8000-000000000005', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000005', 'attended', 'very_interested', 'Spurði um mögulegan afhendingartíma.', 'today', '2026-10-03 12:00:00+00', false, v_sara_id),
    ('81000000-0000-4000-8000-000000000006', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000006', 'attended', 'very_interested', 'Vill skoða eignina aftur með ráðgjafa.', 'second-viewing', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000007', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000007', 'attended', 'interested', 'Óskar eftir nánari upplýsingum um hússjóð.', 'tomorrow', '2026-10-04 12:00:00+00', false, v_sara_id),
    ('81000000-0000-4000-8000-000000000008', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000008', 'attended', 'unsure', 'Er að bera eignina saman við aðra í hverfinu.', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000009', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000009', 'attended', 'not_interested', 'Eignin hentar ekki núverandi þörfum.', 'none', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000010', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000010', 'no_show', 'unset', '', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000011', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000011', 'no_show', 'unset', '', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000012', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000012', 'no_show', 'unset', '', 'wait', null, false, v_sara_id)
  on conflict (id) do update set
    attendance = excluded.attendance,
    interest = excluded.interest,
    internal_notes = excluded.internal_notes,
    next_action = excluded.next_action,
    follow_up_due_at = excluded.follow_up_due_at,
    is_walk_in = excluded.is_walk_in;

  insert into public.offers (
    id, organization_id, transaction_id, buyer_contact_id, amount_isk,
    valid_until, requested_handover_date, status, submitted_at, created_by
  ) values (
    '90000000-0000-4000-8000-000000001042', v_org_id,
    '40000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    82500000, '2026-10-02 20:00:00+00', '2026-12-01', 'submitted',
    '2026-10-02 12:14:00+00', null
  )
  on conflict (id) do update set
    buyer_contact_id = excluded.buyer_contact_id,
    amount_isk = excluded.amount_isk,
    valid_until = excluded.valid_until,
    requested_handover_date = excluded.requested_handover_date;

  insert into public.offer_conditions (
    id, organization_id, offer_id, condition_type, status, details
  ) values (
    '91000000-0000-4000-8000-000000000001', v_org_id,
    '90000000-0000-4000-8000-000000001042', 'financing', 'in_progress', null
  )
  on conflict (offer_id, condition_type) do update set
    status = excluded.status,
    details = excluded.details;

  insert into public.offer_reviews (
    id, organization_id, offer_id, reviewed_by, buyer_identified,
    contact_confirmed, financing_needs_confirmation, validity_recorded,
    handover_recorded, internal_notes, reviewed_at
  ) values (
    '92000000-0000-4000-8000-000000000001', v_org_id,
    '90000000-0000-4000-8000-000000001042', v_sara_id,
    true, true, true, true, true, '', null
  )
  on conflict (offer_id) do update set
    reviewed_by = excluded.reviewed_by,
    buyer_identified = excluded.buyer_identified,
    contact_confirmed = excluded.contact_confirmed,
    financing_needs_confirmation = excluded.financing_needs_confirmation,
    validity_recorded = excluded.validity_recorded,
    handover_recorded = excluded.handover_recorded;

  insert into public.offer_status_history (
    id, organization_id, offer_id, from_status, to_status, changed_by, reason, created_at
  ) values
    ('93000000-0000-4000-8000-000000000001', v_org_id, '90000000-0000-4000-8000-000000001042', null, 'draft', null, 'Demo buyer draft created', '2026-10-02 12:00:00+00'),
    ('93000000-0000-4000-8000-000000000002', v_org_id, '90000000-0000-4000-8000-000000001042', 'draft', 'submitted', null, 'Demo buyer submission', '2026-10-02 12:14:00+00')
  on conflict (id) do nothing;

  insert into public.activity_events (
    id, organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata, created_at
  ) values (
    '94000000-0000-4000-8000-000000000001', v_org_id,
    '40000000-0000-4000-8000-000000000001', null, 'offer_submitted',
    'buyer', 'Offer submitted',
    jsonb_build_object('offer_id', '90000000-0000-4000-8000-000000001042'),
    '2026-10-02 12:14:00+00'
  )
  on conflict (id) do nothing;

  insert into public.tasks (
    id, organization_id, transaction_id, assigned_to, title, description,
    status, due_at, visibility, created_by, completed_at
  ) values
    ('a1000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Söluyfirlit', null, 'completed', null, 'seller_and_buyer', v_sara_id, '2026-09-29 12:00:00+00'),
    ('a1000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Eignaskrá', null, 'completed', null, 'seller_and_buyer', v_sara_id, '2026-09-29 14:00:00+00'),
    ('a1000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Ljósmyndir', null, 'completed', null, 'seller', v_sara_id, '2026-09-30 10:00:00+00'),
    ('a1000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Samþykki seljanda', null, 'completed', null, 'seller', v_sara_id, '2026-09-30 15:00:00+00'),
    ('a1000000-0000-4000-8000-000000000005', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Staðfesta fjármögnun kaupanda', 'Fylgja eftir staðfestingu frá kaupanda.', 'in_progress', '2026-10-04 15:00:00+00', 'internal', v_sara_id, null)
  on conflict (id) do update set
    assigned_to=excluded.assigned_to,title=excluded.title,description=excluded.description,
    status=excluded.status,due_at=excluded.due_at,visibility=excluded.visibility,
    completed_at=excluded.completed_at;

  insert into public.documents (
    id, organization_id, transaction_id, storage_path, title, document_type,
    visibility, uploaded_by, file_name, mime_type, file_size_bytes, description
  ) values
    ('a2000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', 'organizations/10000000-0000-4000-8000-000000000001/transactions/40000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000001/soluyfirlit.pdf', 'Söluyfirlit', 'sales_overview', 'shared', v_sara_id, 'soluyfirlit.pdf', 'application/pdf', null, 'Fictional metadata only'),
    ('a2000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000001', 'organizations/10000000-0000-4000-8000-000000000001/transactions/40000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000002/eignaskra.pdf', 'Eignaskrá', 'property_registry', 'shared', v_sara_id, 'eignaskra.pdf', 'application/pdf', null, 'Fictional metadata only'),
    ('a2000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000001', 'organizations/10000000-0000-4000-8000-000000000001/transactions/40000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000003/teikningar.pdf', 'Teikningar', 'drawings', 'shared', v_sara_id, 'teikningar.pdf', 'application/pdf', null, 'Fictional metadata only'),
    ('a2000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000001', 'organizations/10000000-0000-4000-8000-000000000001/transactions/40000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000004/hussjodur.pdf', 'Upplýsingar um hússjóð', 'hoa_information', 'shared', v_sara_id, 'hussjodur.pdf', 'application/pdf', null, 'Fictional metadata only'),
    ('a2000000-0000-4000-8000-000000000005', v_org_id, '40000000-0000-4000-8000-000000000001', 'organizations/10000000-0000-4000-8000-000000000001/transactions/40000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000005/orku-og-astandsupplysingar.pdf', 'Orku- og ástandsupplýsingar', 'condition_information', 'shared', v_sara_id, 'orku-og-astandsupplysingar.pdf', 'application/pdf', null, 'Fictional metadata only')
  on conflict (id) do update set
    title=excluded.title,document_type=excluded.document_type,visibility=excluded.visibility,
    file_name=excluded.file_name,mime_type=excluded.mime_type,description=excluded.description;

  if v_anna_id is not null then
    insert into public.profiles (id, display_name, email, account_type)
    values (v_anna_id, 'Anna Jónsdóttir', 'anna@demo.is', 'customer')
    on conflict (id) do update set display_name = excluded.display_name, email = excluded.email, account_type = excluded.account_type;

    insert into public.portal_access_grants (
      id, organization_id, transaction_id, user_id, contact_id, role,
      status, created_by, activated_at, revoked_at
    ) values (
      '95000000-0000-4000-8000-000000000001', v_org_id,
      '40000000-0000-4000-8000-000000000001', v_anna_id,
      '30000000-0000-4000-8000-000000000001', 'seller',
      'active', v_sara_id, now(), null
    ) on conflict (transaction_id, user_id, role) do update set
      contact_id = excluded.contact_id,
      status = 'active',
      activated_at = now(),
      revoked_at = null;
  else
    raise notice 'Seller portal seed skipped: create anna@demo.is in Auth and rerun the seed.';
  end if;

  if v_jon_id is not null then
    insert into public.profiles (id, display_name, email, account_type)
    values (v_jon_id, 'Jón Jónsson', 'jon@demo.is', 'customer')
    on conflict (id) do update set display_name = excluded.display_name, email = excluded.email, account_type = excluded.account_type;

    update public.offers
    set buyer_user_id = v_jon_id
    where id = '90000000-0000-4000-8000-000000001042';

    insert into public.portal_access_grants (
      id, organization_id, transaction_id, user_id, contact_id, role,
      status, created_by, activated_at, revoked_at
    ) values (
      '95000000-0000-4000-8000-000000000002', v_org_id,
      '40000000-0000-4000-8000-000000000001', v_jon_id,
      '31000000-0000-4000-8000-000000000001', 'accepted_buyer',
      'active', v_sara_id, now(), null
    ) on conflict (transaction_id, user_id, role) do update set
      contact_id = excluded.contact_id,
      status = 'active',
      activated_at = now(),
      revoked_at = null;
  else
    raise notice 'Buyer portal seed skipped: create jon@demo.is in Auth and rerun the seed.';
  end if;
end
$$;
