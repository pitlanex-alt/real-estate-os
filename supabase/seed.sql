-- Kelvo Demo Dataset v1.
--
-- Development seed only. This file never creates Auth users or stores passwords.
-- Before running it, create these users in Supabase Auth:
--   sara@demo.is, anna@demo.is, jon@demo.is
-- Auth email lookups are only for the repeatable demo environment. Production
-- onboarding creates profiles, memberships and portal grants in the application.

do $$
declare
  v_sara_id uuid;
  v_anna_id uuid;
  v_jon_id uuid;
  v_org_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_day_start timestamptz :=
    date_trunc('day', now() at time zone 'Atlantic/Reykjavik')
      at time zone 'Atlantic/Reykjavik';
  v_offer_submitted_at timestamptz := now() - interval '3 hours';
  v_agent_approved_at timestamptz := now() - interval '2 hours 30 minutes';
  v_sent_to_seller_at timestamptz := now() - interval '2 hours';
  v_seller_intent_at timestamptz := now() - interval '1 hour 30 minutes';
  v_offer_accepted_at timestamptz := now() - interval '1 hour';
  v_has_listing_photo boolean;
begin
  select auth_user.id into v_sara_id
  from auth.users auth_user
  where lower(auth_user.email) = 'sara@demo.is'
  order by auth_user.created_at
  limit 1;

  if v_sara_id is null then
    raise notice 'Kelvo demo seed skipped: create sara@demo.is in Auth and rerun supabase/seed.sql.';
    return;
  end if;

  select auth_user.id into v_anna_id
  from auth.users auth_user
  where lower(auth_user.email) = 'anna@demo.is'
  order by auth_user.created_at
  limit 1;

  select auth_user.id into v_jon_id
  from auth.users auth_user
  where lower(auth_user.email) = 'jon@demo.is'
  order by auth_user.created_at
  limit 1;

  insert into public.profiles (
    id, display_name, professional_title, phone, email, account_type
  ) values (
    v_sara_id, 'Sara Guðmundsdóttir', 'Löggiltur fasteignasali',
    '699 4102', 'sara@nordurhus.is', 'internal'
  ) on conflict (id) do update set
    display_name = excluded.display_name,
    professional_title = excluded.professional_title,
    phone = excluded.phone,
    email = excluded.email,
    account_type = excluded.account_type;

  if v_anna_id is not null then
    insert into public.profiles (id, display_name, phone, email, account_type)
    values (
      v_anna_id, 'Anna Jónsdóttir', '699 1234',
      'anna.jonsdottir@kelvo-demo.is', 'customer'
    ) on conflict (id) do update set
      display_name = excluded.display_name,
      phone = excluded.phone,
      email = excluded.email,
      account_type = excluded.account_type;
  end if;

  if v_jon_id is not null then
    insert into public.profiles (id, display_name, phone, email, account_type)
    values (
      v_jon_id, 'Jón Jónsson', '699 2233',
      'jon.jonsson@kelvo-demo.is', 'customer'
    ) on conflict (id) do update set
      display_name = excluded.display_name,
      phone = excluded.phone,
      email = excluded.email,
      account_type = excluded.account_type;
  end if;

  insert into public.organizations (
    id, name, public_email, phone, website, address,
    default_contact_name, default_contact_email, default_contact_phone
  ) values (
    v_org_id, 'Norðurhús fasteignasala', 'mottaka@nordurhus.is',
    '519 8800', 'https://nordurhus.is', 'Borgartún 24, 105 Reykjavík',
    'Sara Guðmundsdóttir', 'sara@nordurhus.is', '699 4102'
  ) on conflict (id) do update set
    name = excluded.name,
    public_email = excluded.public_email,
    phone = excluded.phone,
    website = excluded.website,
    address = excluded.address,
    default_contact_name = excluded.default_contact_name,
    default_contact_email = excluded.default_contact_email,
    default_contact_phone = excluded.default_contact_phone;

  insert into public.organization_memberships (
    organization_id, user_id, role, is_active
  ) values (v_org_id, v_sara_id, 'admin', true)
  on conflict (organization_id, user_id) do update set
    role = excluded.role,
    is_active = true;

  insert into public.properties (
    id, organization_id, slug, address_line, postal_code, municipality,
    registry_number, size_sqm, room_count, bedroom_count, year_built,
    property_type, floor, parking, monthly_fees_isk
  ) values
    (
      '20000000-0000-4000-8000-000000000001', v_org_id,
      'laugavegur-120', 'Laugavegur 120', '101', 'Reykjavík',
      '224-5187', 112, 4, 3, 2018, 'Íbúð', 4,
      'Stæði í bílageymslu', 32700
    ),
    (
      '20000000-0000-4000-8000-000000000002', v_org_id,
      'alfheimar-14', 'Álfheimar 14', '104', 'Reykjavík',
      '205-7714', 96.4, 4, 3, 1972, 'Íbúð', 2,
      'Stæði á lóð', 28500
    ),
    (
      '20000000-0000-4000-8000-000000000003', v_org_id,
      'hringbraut-76', 'Hringbraut 76', '107', 'Reykjavík',
      '201-6376', 87.6, 3, 2, 1956, 'Íbúð', 3,
      'Bílastæði við götu', 31700
    ),
    (
      '20000000-0000-4000-8000-000000000004', v_org_id,
      'solvallagata-42', 'Sólvallagata 42', '101', 'Reykjavík',
      '200-9442', 145.2, 5, 4, 1930, 'Sérhæð', 1,
      'Bílskúr', 18400
    )
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    slug = excluded.slug,
    address_line = excluded.address_line,
    postal_code = excluded.postal_code,
    municipality = excluded.municipality,
    registry_number = excluded.registry_number,
    size_sqm = excluded.size_sqm,
    room_count = excluded.room_count,
    bedroom_count = excluded.bedroom_count,
    year_built = excluded.year_built,
    property_type = excluded.property_type,
    floor = excluded.floor,
    parking = excluded.parking,
    monthly_fees_isk = excluded.monthly_fees_isk;

  insert into public.contacts (
    id, organization_id, full_name, phone, email, created_by
  ) values
    (
      '30000000-0000-4000-8000-000000000001', v_org_id,
      'Anna Jónsdóttir', '699 1234', 'anna.jonsdottir@kelvo-demo.is', v_sara_id
    ),
    (
      '30000000-0000-4000-8000-000000000002', v_org_id,
      'Guðrún Ólafsdóttir', '867 2401', 'gudrun.olafsdottir@kelvo-demo.is', v_sara_id
    ),
    (
      '30000000-0000-4000-8000-000000000003', v_org_id,
      'Magnús Karlsson', '661 8450', 'magnus.karlsson@kelvo-demo.is', v_sara_id
    ),
    (
      '30000000-0000-4000-8000-000000000004', v_org_id,
      'Katrín Magnúsdóttir', '821 3774', 'katrin.magnusdottir@kelvo-demo.is', v_sara_id
    )
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email;

  select exists (
    select 1 from public.property_images image
    where image.property_id = '20000000-0000-4000-8000-000000000001'
  ) into v_has_listing_photo;

  insert into public.transactions (
    id, organization_id, property_id, assigned_agent_id, stage,
    asking_price_isk, started_at, completed_at, created_by,
    listing_title, listing_description, listing_highlights,
    listing_seller_approved, listing_documents_ready, listing_readiness,
    listing_revision, ready_for_publish_at, ready_for_publish_by, created_at
  ) values
    (
      '40000000-0000-4000-8000-000000000001', v_org_id,
      '20000000-0000-4000-8000-000000000001', v_sara_id, 'contract',
      84900000, v_day_start - interval '30 days', null, v_sara_id,
      'Björt og vönduð fjögurra herbergja íbúð við Laugaveg',
      'Falleg og vel skipulögð 112 m² fjögurra herbergja íbúð á fjórðu hæð við Laugaveg. Eignin var byggð árið 2018 og býður upp á rúmgóða stofu og eldhús í opnu rými, þrjú svefnherbergi, baðherbergi og gott geymslupláss. Stórir gluggar veita ríkulega birtu og frá íbúðinni er stutt í verslun, þjónustu, menningu og samgöngur miðborgarinnar. Stæði í bílageymslu fylgir eigninni.',
      array[
        'Þrjú rúmgóð svefnherbergi',
        'Stæði í bílageymslu',
        'Björt og vel skipulögð',
        'Frábær staðsetning í miðborginni'
      ],
      (v_anna_id is not null), true,
      case when v_anna_id is not null and v_has_listing_photo then 'ready' else 'in_progress' end,
      1,
      case when v_anna_id is not null and v_has_listing_photo
        then v_day_start - interval '7 days' else null end,
      case when v_anna_id is not null and v_has_listing_photo
        then v_sara_id else null end,
      v_day_start
    ),
    (
      '40000000-0000-4000-8000-000000000002', v_org_id,
      '20000000-0000-4000-8000-000000000002', v_sara_id, 'preparation',
      null, v_day_start - interval '5 days', null, v_sara_id,
      null, null, '{}'::text[], false, false, 'in_progress', 0, null, null,
      v_day_start - interval '3 days'
    ),
    (
      '40000000-0000-4000-8000-000000000003', v_org_id,
      '20000000-0000-4000-8000-000000000003', v_sara_id, 'listed',
      72900000, v_day_start - interval '21 days', null, v_sara_id,
      'Vel skipulögð þriggja herbergja íbúð við Hringbraut',
      'Björt þriggja herbergja íbúð í grónu hverfi vesturbæjar.',
      array['Tvö svefnherbergi', 'Góð staðsetning í vesturbænum'],
      true, true, 'in_progress', 1, null, null,
      v_day_start - interval '2 days'
    ),
    (
      '40000000-0000-4000-8000-000000000004', v_org_id,
      '20000000-0000-4000-8000-000000000004', v_sara_id, 'valuation',
      null, v_day_start, null, v_sara_id,
      null, null, '{}'::text[], false, false, 'not_started', 0, null, null,
      v_day_start - interval '1 day'
    )
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    property_id = excluded.property_id,
    assigned_agent_id = excluded.assigned_agent_id,
    stage = excluded.stage,
    asking_price_isk = excluded.asking_price_isk,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at,
    created_by = excluded.created_by,
    listing_title = excluded.listing_title,
    listing_description = excluded.listing_description,
    listing_highlights = excluded.listing_highlights,
    listing_seller_approved = excluded.listing_seller_approved,
    listing_documents_ready = excluded.listing_documents_ready,
    listing_readiness = excluded.listing_readiness,
    listing_revision = excluded.listing_revision,
    ready_for_publish_at = excluded.ready_for_publish_at,
    ready_for_publish_by = excluded.ready_for_publish_by,
    created_at = excluded.created_at;

  insert into public.transaction_assignments (
    organization_id, transaction_id, user_id, role
  ) values
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
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    transaction_id = excluded.transaction_id,
    contact_id = excluded.contact_id,
    role = excluded.role,
    is_primary = excluded.is_primary;

  -- Restore a deterministic stage history for the four seeded transactions.
  delete from public.transaction_stage_history
  where transaction_id in (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004'
  );

  insert into public.transaction_stage_history (
    id, organization_id, transaction_id, from_stage, to_stage,
    changed_by, reason, created_at
  ) values
    ('60000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', null, 'valuation', v_sara_id, 'Verðmat skráð', v_day_start - interval '30 days'),
    ('61000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', 'valuation', 'preparation', v_sara_id, 'Undirbúningur sölu hafinn', v_day_start - interval '20 days'),
    ('61000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000001', 'preparation', 'listed', v_sara_id, 'Skráning tilbúin og eign sett á sölu', v_day_start - interval '7 days'),
    ('61000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000001', 'listed', 'viewings', v_sara_id, 'Skoðunarferli hafið', v_day_start - interval '2 days'),
    ('61000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000001', 'viewings', 'contract', v_sara_id, 'Tilboð staðfest sem samþykkt', v_offer_accepted_at),
    ('60000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000002', null, 'preparation', v_sara_id, 'Undirbúningur sölu hafinn', v_day_start - interval '5 days'),
    ('60000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000003', null, 'listed', v_sara_id, 'Eign sett á sölu', v_day_start - interval '14 days'),
    ('60000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000004', null, 'valuation', v_sara_id, 'Verðmatsferli hafið', v_day_start);

  insert into public.contacts (
    id, organization_id, full_name, phone, email, created_by
  ) values
    ('31000000-0000-4000-8000-000000000001', v_org_id, 'Jón Jónsson', '699 2233', 'jon.jonsson@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000002', v_org_id, 'Sara Magnúsdóttir', '868 4421', 'sara.magnusdottir@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000003', v_org_id, 'Pétur Karlsson', '777 9191', 'petur.karlsson@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000004', v_org_id, 'Elín Guðmundsdóttir', '611 4722', 'elin.gudmundsdottir@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000005', v_org_id, 'Guðmundur Ari Sigurðsson', '690 3845', 'gudmundur.sigurdsson@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000006', v_org_id, 'Ragna Björnsdóttir', '824 5631', 'ragna.bjornsdottir@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000007', v_org_id, 'Viktor Ólafsson', '778 2046', 'viktor.olafsson@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000008', v_org_id, 'Helga María Eiríksdóttir', '698 7214', 'helga.eiriksdottir@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000009', v_org_id, 'Ólafur Gunnarsson', '862 1198', 'olafur.gunnarsson@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000010', v_org_id, 'Karen Þorvaldsdóttir', '615 8872', 'karen.thorvaldsdottir@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000011', v_org_id, 'Bjarni Hólm', '823 7710', 'bjarni.holm@kelvo-demo.is', v_sara_id),
    ('31000000-0000-4000-8000-000000000012', v_org_id, 'Sigríður Anna Jónsdóttir', '694 4081', 'sigridur.jonsdottir@kelvo-demo.is', v_sara_id)
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email;

  -- The demo transaction has one completed open house. Extra ad-hoc viewings on
  -- this fixed demo transaction are removed so local reseeding restores one story.
  delete from public.viewings
  where transaction_id = '40000000-0000-4000-8000-000000000001'
    and id <> '80000000-0000-4000-8000-000000000001';

  insert into public.viewings (
    id, organization_id, transaction_id, viewing_type, starts_at, ends_at,
    status, created_by, completed_at
  ) values
    (
      '80000000-0000-4000-8000-000000000001', v_org_id,
      '40000000-0000-4000-8000-000000000001', 'open_house',
      v_day_start - interval '1 day' + interval '17 hours 30 minutes',
      v_day_start - interval '1 day' + interval '18 hours 15 minutes',
      'completed', v_sara_id,
      v_day_start - interval '1 day' + interval '18 hours 15 minutes'
    ),
    (
      '80000000-0000-4000-8000-000000000002', v_org_id,
      '40000000-0000-4000-8000-000000000003', 'open_house',
      v_day_start + interval '1 day 17 hours 30 minutes',
      v_day_start + interval '1 day 18 hours 15 minutes',
      'scheduled', v_sara_id, null
    )
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    transaction_id = excluded.transaction_id,
    viewing_type = excluded.viewing_type,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    status = excluded.status,
    created_by = excluded.created_by,
    completed_at = excluded.completed_at;

  -- Keep the fixed open-house totals deterministic after walk-in testing.
  delete from public.viewing_guests
  where viewing_id = '80000000-0000-4000-8000-000000000001'
    and id not in (
      '81000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000003',
      '81000000-0000-4000-8000-000000000004',
      '81000000-0000-4000-8000-000000000005',
      '81000000-0000-4000-8000-000000000006',
      '81000000-0000-4000-8000-000000000007',
      '81000000-0000-4000-8000-000000000008',
      '81000000-0000-4000-8000-000000000009',
      '81000000-0000-4000-8000-000000000010',
      '81000000-0000-4000-8000-000000000011',
      '81000000-0000-4000-8000-000000000012'
    );

  insert into public.viewing_guests (
    id, organization_id, viewing_id, contact_id, attendance, interest,
    internal_notes, next_action, follow_up_due_at, is_walk_in, created_by
  ) values
    ('81000000-0000-4000-8000-000000000001', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'attended', 'very_interested', 'Óskaði eftir upplýsingum um afhendingu og sendi síðar inn tilboð.', 'none', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000002', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 'attended', 'interested', 'Óskaði eftir annarri skoðun.', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000003', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', 'attended', 'interested', 'Fjármögnun var ekki staðfest við skoðun.', 'tomorrow', v_day_start + interval '1 day 11 hours', false, v_sara_id),
    ('81000000-0000-4000-8000-000000000004', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000004', 'attended', 'unsure', 'Vildi ræða verð og staðsetningu við maka.', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000005', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000005', 'attended', 'very_interested', 'Spurði um mögulegan afhendingartíma.', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000006', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000006', 'attended', 'very_interested', 'Vildi skoða eignina aftur með ráðgjafa.', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000007', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000007', 'attended', 'interested', 'Óskaði eftir nánari upplýsingum um hússjóð.', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000008', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000008', 'attended', 'unsure', 'Bar eignina saman við aðra í hverfinu.', 'wait', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000009', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000009', 'attended', 'not_interested', 'Eignin hentaði ekki núverandi þörfum.', 'none', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000010', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000010', 'no_show', 'unset', '', 'none', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000011', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000011', 'no_show', 'unset', '', 'none', null, false, v_sara_id),
    ('81000000-0000-4000-8000-000000000012', v_org_id, '80000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000012', 'no_show', 'unset', '', 'none', null, false, v_sara_id)
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    viewing_id = excluded.viewing_id,
    contact_id = excluded.contact_id,
    attendance = excluded.attendance,
    interest = excluded.interest,
    internal_notes = excluded.internal_notes,
    next_action = excluded.next_action,
    follow_up_due_at = excluded.follow_up_due_at,
    is_walk_in = excluded.is_walk_in,
    created_by = excluded.created_by;

  insert into public.offers (
    id, organization_id, transaction_id, buyer_contact_id, buyer_user_id,
    amount_isk, valid_until, requested_handover_date, status, submitted_at,
    agent_approved_at, sent_to_seller_at, created_by, created_at
  ) values (
    '90000000-0000-4000-8000-000000001042', v_org_id,
    '40000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001', v_jon_id,
    82500000, now() + interval '1 day',
    (v_day_start at time zone 'Atlantic/Reykjavik')::date + 60,
    'accepted', v_offer_submitted_at,
    v_agent_approved_at,
    v_sent_to_seller_at, null,
    now() - interval '4 hours'
  ) on conflict (id) do update set
    organization_id = excluded.organization_id,
    transaction_id = excluded.transaction_id,
    buyer_contact_id = excluded.buyer_contact_id,
    buyer_user_id = excluded.buyer_user_id,
    amount_isk = excluded.amount_isk,
    valid_until = excluded.valid_until,
    requested_handover_date = excluded.requested_handover_date,
    status = excluded.status,
    submitted_at = excluded.submitted_at,
    agent_approved_at = excluded.agent_approved_at,
    sent_to_seller_at = excluded.sent_to_seller_at,
    created_by = excluded.created_by,
    created_at = excluded.created_at;

  insert into public.offer_conditions (
    id, organization_id, offer_id, condition_type, status, details
  ) values (
    '91000000-0000-4000-8000-000000000001', v_org_id,
    '90000000-0000-4000-8000-000000001042',
    'financing', 'in_progress', 'Fjármögnun í vinnslu hjá viðskiptabanka kaupanda.'
  ) on conflict (offer_id, condition_type) do update set
    organization_id = excluded.organization_id,
    status = excluded.status,
    details = excluded.details;

  insert into public.offer_reviews (
    id, organization_id, offer_id, reviewed_by, buyer_identified,
    contact_confirmed, financing_needs_confirmation, validity_recorded,
    handover_recorded, internal_notes, change_request, reviewed_at
  ) values (
    '92000000-0000-4000-8000-000000000001', v_org_id,
    '90000000-0000-4000-8000-000000001042', v_sara_id,
    true, true, true, true, true,
    'Tilboð yfirfarið. Fylgja þarf eftir endanlegri staðfestingu fjármögnunar.',
    null, v_agent_approved_at
  ) on conflict (offer_id) do update set
    organization_id = excluded.organization_id,
    reviewed_by = excluded.reviewed_by,
    buyer_identified = excluded.buyer_identified,
    contact_confirmed = excluded.contact_confirmed,
    financing_needs_confirmation = excluded.financing_needs_confirmation,
    validity_recorded = excluded.validity_recorded,
    handover_recorded = excluded.handover_recorded,
    internal_notes = excluded.internal_notes,
    change_request = excluded.change_request,
    reviewed_at = excluded.reviewed_at;

  -- These append-only rows use stable IDs. Rerunning the seed never duplicates
  -- the offer history, while a fresh reset receives the complete lifecycle.
  insert into public.offer_status_history (
    id, organization_id, offer_id, from_status, to_status,
    changed_by, reason, created_at
  ) values
    ('93000000-0000-4000-8000-000000000001', v_org_id, '90000000-0000-4000-8000-000000001042', null, 'draft', v_jon_id, 'Drög að tilboði stofnuð', now() - interval '4 hours'),
    ('93000000-0000-4000-8000-000000000002', v_org_id, '90000000-0000-4000-8000-000000001042', 'draft', 'submitted', v_jon_id, 'Tilboð sent til fasteignasala', v_offer_submitted_at),
    ('93000000-0000-4000-8000-000000000003', v_org_id, '90000000-0000-4000-8000-000000001042', 'submitted', 'agent_approved', v_sara_id, 'Tilboð yfirfarið af fasteignasala', v_agent_approved_at),
    ('93000000-0000-4000-8000-000000000004', v_org_id, '90000000-0000-4000-8000-000000001042', 'agent_approved', 'sent_to_seller', v_sara_id, 'Tilboð sent seljanda', v_sent_to_seller_at),
    ('93000000-0000-4000-8000-000000000005', v_org_id, '90000000-0000-4000-8000-000000001042', 'sent_to_seller', 'seller_intent_recorded', v_anna_id, 'Seljandi lýsti vilja til samþykktar', v_seller_intent_at),
    ('93000000-0000-4000-8000-000000000006', v_org_id, '90000000-0000-4000-8000-000000001042', 'seller_intent_recorded', 'accepted', v_sara_id, 'Tilboð staðfest sem samþykkt af fasteignasala', v_offer_accepted_at)
  on conflict (id) do nothing;

  if v_anna_id is not null then
    insert into public.seller_listing_responses (
      id, organization_id, transaction_id, seller_contact_id,
      seller_user_id, response_type, feedback, submitted_at, listing_revision
    ) values (
      '96000000-0000-4000-8000-000000000001', v_org_id,
      '40000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001', v_anna_id,
      'approved', 'Skráningin er samþykkt og tilbúin til birtingar.',
      v_day_start - interval '8 days', 1
    ) on conflict (id) do nothing;

    insert into public.seller_offer_responses (
      id, organization_id, offer_id, seller_contact_id, intent,
      submitted_by, submitted_at, agent_acknowledged_at
    ) values (
      '97000000-0000-4000-8000-000000000001', v_org_id,
      '90000000-0000-4000-8000-000000001042',
      '30000000-0000-4000-8000-000000000001', 'accept',
      v_anna_id, v_seller_intent_at,
      v_offer_accepted_at
    ) on conflict (id) do nothing;

    insert into public.portal_access_grants (
      id, organization_id, transaction_id, user_id, contact_id, role,
      status, created_by, activated_at, revoked_at
    ) values (
      '95000000-0000-4000-8000-000000000001', v_org_id,
      '40000000-0000-4000-8000-000000000001', v_anna_id,
      '30000000-0000-4000-8000-000000000001', 'seller',
      'active', v_sara_id, v_day_start - interval '20 days', null
    ) on conflict (transaction_id, user_id, role) do update set
      contact_id = excluded.contact_id,
      status = 'active',
      activated_at = excluded.activated_at,
      revoked_at = null;
  else
    raise notice 'Seller portal data skipped: create anna@demo.is in Auth and rerun the seed.';
  end if;

  if v_jon_id is not null then
    insert into public.portal_access_grants (
      id, organization_id, transaction_id, user_id, contact_id, role,
      status, created_by, activated_at, revoked_at
    ) values (
      '95000000-0000-4000-8000-000000000002', v_org_id,
      '40000000-0000-4000-8000-000000000001', v_jon_id,
      '31000000-0000-4000-8000-000000000001', 'accepted_buyer',
      'active', v_sara_id, v_day_start - interval '2 days', null
    ) on conflict (transaction_id, user_id, role) do update set
      contact_id = excluded.contact_id,
      status = 'active',
      activated_at = excluded.activated_at,
      revoked_at = null;
  else
    raise notice 'Buyer portal data skipped: create jon@demo.is in Auth and rerun the seed.';
  end if;

  -- Reset only the known task set for the fixed Laugavegur demo transaction.
  -- This also removes a trigger-created duplicate if the stage change initialized
  -- the Phase 8B checklist before this section runs.
  delete from public.tasks
  where transaction_id = '40000000-0000-4000-8000-000000000001'
    and (
      id = 'a1000000-0000-4000-8000-000000000005'
      or title in (
        'Staðfesta fjármögnun',
        'Yfirfara skilyrði tilboðs',
        'Staðfesta afhendingardag',
        'Safna nauðsynlegum skjölum',
        'Undirbúa kaupsamning',
        'Bóka undirritun'
      )
    );

  insert into public.tasks (
    id, organization_id, transaction_id, assigned_to, title, description,
    status, due_at, visibility, created_by, completed_at
  ) values
    ('a1000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Söluyfirlit', 'Söluyfirlit yfirfarið og samþykkt.', 'completed', null, 'seller_and_buyer', v_sara_id, v_day_start - interval '12 days'),
    ('a1000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Eignaskrá', 'Upplýsingar úr eignaskrá yfirfarnar.', 'completed', null, 'seller_and_buyer', v_sara_id, v_day_start - interval '12 days'),
    ('a1000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Ljósmyndir', 'Ljósmyndun eignarinnar lokið.', 'completed', null, 'seller', v_sara_id, v_day_start - interval '10 days'),
    ('a1000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Samþykki seljanda', 'Seljandi samþykkti skráningu eignarinnar.', 'completed', null, 'seller', v_sara_id, v_day_start - interval '8 days'),
    ('a1100000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Staðfesta fjármögnun', 'Fá endanlega staðfestingu á fjármögnun kaupanda.', 'in_progress', v_day_start + interval '1 day 14 hours', 'internal', v_sara_id, null),
    ('a1100000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Yfirfara skilyrði tilboðs', 'Yfirfara fjármögnunarskilyrði með kaupanda.', 'completed', null, 'internal', v_sara_id, v_day_start + interval '11 hours'),
    ('a1100000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Staðfesta afhendingardag', 'Staðfesta afhendingardag við báða aðila.', 'completed', null, 'internal', v_sara_id, v_day_start + interval '11 hours 15 minutes'),
    ('a1100000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Safna nauðsynlegum skjölum', 'Safna fylgiskjölum fyrir gerð kaupsamnings.', 'in_progress', v_day_start + interval '2 days 15 hours', 'internal', v_sara_id, null),
    ('a1100000-0000-4000-8000-000000000005', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Undirbúa kaupsamning', 'Undirbúa drög að kaupsamningi til yfirferðar.', 'not_started', v_day_start + interval '4 days 13 hours', 'internal', v_sara_id, null),
    ('a1100000-0000-4000-8000-000000000006', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'Bóka undirritun', 'Finna tíma sem hentar kaupanda og seljanda.', 'not_started', v_day_start + interval '6 days 14 hours', 'internal', v_sara_id, null)
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    transaction_id = excluded.transaction_id,
    assigned_to = excluded.assigned_to,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    due_at = excluded.due_at,
    visibility = excluded.visibility,
    created_by = excluded.created_by,
    completed_at = excluded.completed_at;

  -- Seed metadata without a backing private Storage object is intentionally
  -- removed. Real PDFs can be uploaded later through the application.
  delete from public.documents
  where id in (
    'a2000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000004',
    'a2000000-0000-4000-8000-000000000005'
  );

  -- Activity events are not an immutable legal/audit ledger. Reset only the
  -- fixed main demo transaction so ad-hoc local testing cannot fragment its story.
  delete from public.activity_events
  where transaction_id = '40000000-0000-4000-8000-000000000001';

  -- Keep the operational next action for every portfolio property deterministic.
  insert into public.activity_events (
    id, organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata, created_at
  ) values
    ('70000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'next_action', 'internal', 'Staðfesta fjármögnun og undirbúa kaupsamning', '{}'::jsonb, now()),
    ('70000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000002', v_sara_id, 'next_action', 'internal', 'Vantar samþykkt teikningasafn', '{}'::jsonb, v_day_start - interval '1 hour'),
    ('70000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000003', v_sara_id, 'next_action', 'internal', 'Opið hús á morgun kl. 17:30', '{}'::jsonb, v_day_start - interval '30 minutes'),
    ('70000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000004', v_sara_id, 'next_action', 'internal', 'Verðmat bókað á morgun kl. 13:00', '{}'::jsonb, v_day_start - interval '15 minutes')
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    transaction_id = excluded.transaction_id,
    actor_user_id = excluded.actor_user_id,
    event_type = excluded.event_type,
    visibility = excluded.visibility,
    summary = excluded.summary,
    metadata = excluded.metadata,
    created_at = excluded.created_at;

  insert into public.activity_events (
    id, organization_id, transaction_id, actor_user_id, event_type,
    visibility, summary, metadata, created_at
  ) values
    ('74000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'listing_approved', 'seller', 'Seljandi samþykkti skráningu', '{}'::jsonb, v_day_start - interval '8 days'),
    ('74000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'viewing_completed', 'seller', 'Opið hús lauk — 9 gestir mættu', jsonb_build_object('attended', 9, 'registered', 12), v_day_start - interval '1 day' + interval '18 hours 15 minutes'),
    ('94000000-0000-4000-8000-000000000001', v_org_id, '40000000-0000-4000-8000-000000000001', null, 'offer_submitted', 'buyer', 'Tilboð móttekið', jsonb_build_object('offer_id', '90000000-0000-4000-8000-000000001042'), v_offer_submitted_at),
    ('94000000-0000-4000-8000-000000000002', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'offer_sent_to_seller', 'seller_and_buyer', 'Tilboð sent seljanda', jsonb_build_object('offer_id', '90000000-0000-4000-8000-000000001042'), v_sent_to_seller_at),
    ('94000000-0000-4000-8000-000000000003', v_org_id, '40000000-0000-4000-8000-000000000001', null, 'seller_intent_recorded', 'seller', 'Seljandi samþykkti tilboð', jsonb_build_object('offer_id', '90000000-0000-4000-8000-000000001042'), v_seller_intent_at),
    ('94000000-0000-4000-8000-000000000004', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'offer_accepted', 'seller_and_buyer', 'Tilboð staðfest sem samþykkt', jsonb_build_object('offer_id', '90000000-0000-4000-8000-000000001042'), v_offer_accepted_at),
    ('94000000-0000-4000-8000-000000000005', v_org_id, '40000000-0000-4000-8000-000000000001', v_sara_id, 'contract_preparation_initialized', 'internal', 'Undirbúningur kaupsamnings hafinn', '{}'::jsonb, v_offer_accepted_at + interval '1 minute')
  on conflict (id) do update set
    organization_id = excluded.organization_id,
    transaction_id = excluded.transaction_id,
    actor_user_id = excluded.actor_user_id,
    event_type = excluded.event_type,
    visibility = excluded.visibility,
    summary = excluded.summary,
    metadata = excluded.metadata,
    created_at = excluded.created_at;

  -- A ready-to-publish record must never claim that the photo requirement passes
  -- unless a real private Storage-backed property image already exists.
  if v_anna_id is not null and v_has_listing_photo then
    insert into public.activity_events (
      id, organization_id, transaction_id, actor_user_id, event_type,
      visibility, summary, metadata, created_at
    ) values (
      '74000000-0000-4000-8000-000000000002', v_org_id,
      '40000000-0000-4000-8000-000000000001', v_sara_id,
      'listing_ready', 'internal', 'Skráning tilbúin til birtingar',
      '{}'::jsonb, v_day_start - interval '7 days'
    ) on conflict (id) do update set
      organization_id = excluded.organization_id,
      transaction_id = excluded.transaction_id,
      actor_user_id = excluded.actor_user_id,
      event_type = excluded.event_type,
      visibility = excluded.visibility,
      summary = excluded.summary,
      metadata = excluded.metadata,
      created_at = excluded.created_at;
  end if;
end
$$;
