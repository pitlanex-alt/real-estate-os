create function public.customer_transaction_offers(p_transaction_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_seller boolean;
  v_buyer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_seller := private.has_portal_access(
    p_transaction_id,
    array['seller', 'co_owner']::public.party_role[]
  );
  v_buyer := private.has_portal_access(
    p_transaction_id,
    array['accepted_buyer']::public.party_role[]
  );

  if not v_seller and not v_buyer then
    raise exception 'Portal access denied' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', offer.id,
      'status', offer.status,
      'amount_isk', offer.amount_isk,
      'valid_until', offer.valid_until
    ) order by offer.created_at desc)
    from public.offers offer
    where offer.transaction_id = p_transaction_id
      and (
        (v_seller and offer.status in ('sent_to_seller', 'seller_intent_recorded'))
        or (v_buyer and offer.buyer_user_id = auth.uid())
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.customer_transaction_offers(uuid) from public, anon;
grant execute on function public.customer_transaction_offers(uuid) to authenticated;

comment on function public.customer_transaction_offers(uuid) is
  'Lists only seller-shared offers or the authenticated buyer own offers for one actively granted transaction.';

create function public.create_customer_offer_draft(
  p_transaction_id uuid,
  p_amount_isk bigint,
  p_valid_until timestamptz,
  p_requested_handover_date date,
  p_conditions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_contact_id uuid;
  v_org_id uuid;
  v_offer public.offers%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
  v_contact_id := private.portal_contact_id(p_transaction_id, array['accepted_buyer']::public.party_role[]);
  if v_contact_id is null then raise exception 'Portal access denied' using errcode='42501'; end if;
  select organization_id into v_org_id from public.transactions where id=p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode='P0002'; end if;
  if p_amount_isk <= 0 or p_valid_until <= now() then raise exception 'Invalid offer values' using errcode='22023'; end if;
  insert into public.offers(organization_id,transaction_id,buyer_contact_id,buyer_user_id,amount_isk,valid_until,requested_handover_date,status,created_by)
  values(v_org_id,p_transaction_id,v_contact_id,v_user_id,p_amount_isk,p_valid_until,p_requested_handover_date,'draft',null)
  returning * into v_offer;
  perform private.replace_offer_conditions(v_offer.id,p_conditions);
  insert into public.offer_status_history(organization_id,offer_id,from_status,to_status,changed_by,reason)
  values(v_org_id,v_offer.id,null,'draft',v_user_id,'Buyer created offer draft');
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_org_id,p_transaction_id,null,'offer_draft_created','buyer','Buyer created offer draft',jsonb_build_object('offer_id',v_offer.id,'buyer_user_id',v_user_id));
  return public.buyer_offer_status(v_offer.id);
end;
$$;

revoke all on function public.create_customer_offer_draft(uuid,bigint,timestamptz,date,jsonb) from public,anon;
grant execute on function public.create_customer_offer_draft(uuid,bigint,timestamptz,date,jsonb) to authenticated;
