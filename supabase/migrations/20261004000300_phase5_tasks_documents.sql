do $$ begin
  if not exists (select 1 from pg_type where typname = 'task_status' and typnamespace = 'public'::regnamespace) then
    create type public.task_status as enum ('not_started', 'in_progress', 'completed', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_visibility' and typnamespace = 'public'::regnamespace) then
    create type public.document_visibility as enum ('internal', 'seller', 'buyer', 'shared');
  end if;
end $$;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  assigned_to uuid references public.profiles(id),
  title text not null check (length(trim(title)) > 0),
  description text,
  status public.task_status not null default 'not_started',
  due_at timestamptz,
  visibility public.activity_visibility not null default 'internal',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_transaction_id_fkey foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint tasks_transaction_org_fkey foreign key (transaction_id, organization_id) references public.transactions(id, organization_id) on delete cascade,
  constraint tasks_assignee_membership_fkey foreign key (organization_id, assigned_to) references public.organization_memberships(organization_id, user_id),
  constraint tasks_creator_membership_fkey foreign key (organization_id, created_by) references public.organization_memberships(organization_id, user_id),
  constraint tasks_completion_check check ((status = 'completed' and completed_at is not null) or (status <> 'completed' and completed_at is null)),
  unique (id, organization_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_id uuid not null,
  storage_path text not null unique check (length(trim(storage_path)) > 0),
  title text not null check (length(trim(title)) > 0),
  document_type text not null check (length(trim(document_type)) > 0),
  visibility public.document_visibility not null default 'internal',
  uploaded_by uuid not null references public.profiles(id),
  file_name text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_transaction_id_fkey foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint documents_transaction_org_fkey foreign key (transaction_id, organization_id) references public.transactions(id, organization_id) on delete cascade,
  constraint documents_uploader_membership_fkey foreign key (organization_id, uploaded_by) references public.organization_memberships(organization_id, user_id),
  unique (id, organization_id)
);

create index tasks_organization_status_idx on public.tasks (organization_id, status);
create index tasks_transaction_due_idx on public.tasks (transaction_id, due_at);
create index documents_transaction_created_idx on public.documents (transaction_id, created_at desc);
create index documents_organization_visibility_idx on public.documents (organization_id, visibility);

create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function private.set_updated_at();

alter table public.tasks enable row level security;
alter table public.documents enable row level security;

create policy tasks_select_internal_members on public.tasks for select to authenticated using (private.is_org_member(organization_id));
create policy documents_select_internal_members on public.documents for select to authenticated using (private.is_org_member(organization_id));
revoke all on public.tasks, public.documents from anon, authenticated;
grant select on public.tasks, public.documents to authenticated;

create function public.create_task(
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
  values(v_org,p_transaction_id,v_actor,'task_created','internal','Task created',jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  return v_task;
end $$;

create function public.update_task(
  p_task_id uuid, p_title text, p_description text,
  p_assigned_to uuid, p_due_at timestamptz, p_status public.task_status,
  p_visibility public.activity_visibility
)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_task public.tasks%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_task.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null then raise exception 'Task title required' using errcode='22023'; end if;
  if p_assigned_to is not null and not private.is_org_member(v_task.organization_id,p_assigned_to) then raise exception 'Invalid assignee' using errcode='42501'; end if;
  update public.tasks set title=trim(p_title),description=nullif(trim(p_description),''),assigned_to=p_assigned_to,due_at=p_due_at,status=p_status,visibility=p_visibility,
    completed_at=case when p_status='completed' then coalesce(completed_at,now()) else null end
  where id=p_task_id returning * into v_task;
  return v_task;
end $$;

create function public.complete_task(p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_task public.tasks%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_task.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.tasks set status='completed',completed_at=coalesce(completed_at,now()) where id=p_task_id returning * into v_task;
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_task.organization_id,v_task.transaction_id,v_actor,'task_completed',v_task.visibility,'Task completed',jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  return v_task;
end $$;

create function public.cancel_task(p_task_id uuid)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_task public.tasks%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_task.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.tasks set status='cancelled',completed_at=null where id=p_task_id returning * into v_task;
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_task.organization_id,v_task.transaction_id,v_actor,'task_cancelled','internal','Task cancelled',jsonb_build_object('task_id',v_task.id,'title',v_task.title));
  return v_task;
end $$;

create function public.create_document_record(
  p_transaction_id uuid,p_title text,p_document_type text,p_visibility public.document_visibility,
  p_file_name text,p_mime_type text default null,p_file_size_bytes bigint default null,p_description text default null
)
returns public.documents language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_org uuid; v_id uuid:=gen_random_uuid(); v_doc public.documents%rowtype; v_name text;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select organization_id into v_org from public.transactions where id=p_transaction_id;
  if not found then raise exception 'Transaction not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(p_transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  if nullif(trim(p_title),'') is null or nullif(trim(p_document_type),'') is null then raise exception 'Title and document type required' using errcode='22023'; end if;
  v_name:=regexp_replace(coalesce(nullif(trim(p_file_name),''),'document'), '[^A-Za-z0-9._-]+', '-', 'g');
  insert into public.documents(id,organization_id,transaction_id,storage_path,title,document_type,visibility,uploaded_by,file_name,mime_type,file_size_bytes,description)
  values(v_id,v_org,p_transaction_id,format('organizations/%s/transactions/%s/%s/%s',v_org,p_transaction_id,v_id,v_name),trim(p_title),trim(p_document_type),p_visibility,v_actor,v_name,nullif(trim(p_mime_type),''),p_file_size_bytes,nullif(trim(p_description),'')) returning * into v_doc;
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_org,p_transaction_id,v_actor,'document_created','internal','Document record created',jsonb_build_object('document_id',v_doc.id,'title',v_doc.title));
  return v_doc;
end $$;

create function public.update_document_visibility(p_document_id uuid,p_visibility public.document_visibility)
returns public.documents language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_doc public.documents%rowtype; v_old public.document_visibility;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_doc from public.documents where id=p_document_id for update;
  if not found then raise exception 'Document not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_doc.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  v_old:=v_doc.visibility;
  update public.documents set visibility=p_visibility where id=p_document_id returning * into v_doc;
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_doc.organization_id,v_doc.transaction_id,v_actor,'document_visibility_changed','internal','Document visibility changed',jsonb_build_object('document_id',v_doc.id,'from',v_old,'to',p_visibility));
  return v_doc;
end $$;

create function public.delete_document_record(p_document_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_doc public.documents%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_doc from public.documents where id=p_document_id for update;
  if not found then raise exception 'Document not found' using errcode='P0002'; end if;
  if not private.can_manage_transaction(v_doc.transaction_id,v_actor) then raise exception 'Not authorized' using errcode='42501'; end if;
  delete from public.documents where id=p_document_id;
  insert into public.activity_events(organization_id,transaction_id,actor_user_id,event_type,visibility,summary,metadata)
  values(v_doc.organization_id,v_doc.transaction_id,v_actor,'document_deleted','internal','Document metadata deleted',jsonb_build_object('document_id',v_doc.id,'title',v_doc.title));
end $$;

create function public.authorize_document_download(p_document_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_doc public.documents%rowtype; v_allowed boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into v_doc from public.documents where id=p_document_id;
  if not found then raise exception 'Document not found' using errcode='P0002'; end if;
  v_allowed:=private.is_org_member(v_doc.organization_id)
    or (v_doc.visibility in ('seller','shared') and private.has_portal_access(v_doc.transaction_id,array['seller','co_owner']::public.party_role[]))
    or (v_doc.visibility in ('buyer','shared') and private.has_portal_access(v_doc.transaction_id,array['accepted_buyer']::public.party_role[]));
  if not v_allowed then raise exception 'Document access denied' using errcode='42501'; end if;
  return jsonb_build_object('id',v_doc.id,'storage_path',v_doc.storage_path,'file_name',v_doc.file_name,'mime_type',v_doc.mime_type);
end $$;

create function public.customer_visible_tasks(p_transaction_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_seller boolean; v_buyer boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  v_seller:=private.has_portal_access(p_transaction_id,array['seller','co_owner']::public.party_role[]);
  v_buyer:=private.has_portal_access(p_transaction_id,array['accepted_buyer']::public.party_role[]);
  if not v_seller and not v_buyer then raise exception 'Portal access denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'description',t.description,'status',t.status,'due_at',t.due_at,'completed_at',t.completed_at) order by t.created_at)
    from public.tasks t where t.transaction_id=p_transaction_id and ((v_seller and t.visibility in ('seller','seller_and_buyer')) or (v_buyer and t.visibility in ('buyer','seller_and_buyer')))),'[]'::jsonb);
end $$;

create function public.customer_visible_documents(p_transaction_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_seller boolean; v_buyer boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  v_seller:=private.has_portal_access(p_transaction_id,array['seller','co_owner']::public.party_role[]);
  v_buyer:=private.has_portal_access(p_transaction_id,array['accepted_buyer']::public.party_role[]);
  if not v_seller and not v_buyer then raise exception 'Portal access denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'title',d.title,'document_type',d.document_type,'file_name',d.file_name,'mime_type',d.mime_type,'file_size_bytes',d.file_size_bytes,'created_at',d.created_at) order by d.created_at desc)
    from public.documents d where d.transaction_id=p_transaction_id and ((v_seller and d.visibility in ('seller','shared')) or (v_buyer and d.visibility in ('buyer','shared')))),'[]'::jsonb);
end $$;

revoke all on function public.create_task(uuid,text,text,uuid,timestamptz,public.activity_visibility) from public,anon;
revoke all on function public.update_task(uuid,text,text,uuid,timestamptz,public.task_status,public.activity_visibility) from public,anon;
revoke all on function public.complete_task(uuid),public.cancel_task(uuid) from public,anon;
revoke all on function public.create_document_record(uuid,text,text,public.document_visibility,text,text,bigint,text) from public,anon;
revoke all on function public.update_document_visibility(uuid,public.document_visibility),public.delete_document_record(uuid),public.authorize_document_download(uuid),public.customer_visible_tasks(uuid),public.customer_visible_documents(uuid) from public,anon;
grant execute on function public.create_task(uuid,text,text,uuid,timestamptz,public.activity_visibility),public.update_task(uuid,text,text,uuid,timestamptz,public.task_status,public.activity_visibility),public.complete_task(uuid),public.cancel_task(uuid),public.create_document_record(uuid,text,text,public.document_visibility,text,text,bigint,text),public.update_document_visibility(uuid,public.document_visibility),public.delete_document_record(uuid),public.authorize_document_download(uuid),public.customer_visible_tasks(uuid),public.customer_visible_documents(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('transaction-documents','transaction-documents',false,26214400,null)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

create policy transaction_documents_internal_read on storage.objects for select to authenticated using (
  bucket_id='transaction-documents' and exists(select 1 from public.documents d where d.storage_path=name and private.is_org_member(d.organization_id))
);
create policy transaction_documents_customer_read on storage.objects for select to authenticated using (
  bucket_id='transaction-documents' and exists(select 1 from public.documents d where d.storage_path=name and ((d.visibility in ('seller','shared') and private.has_portal_access(d.transaction_id,array['seller','co_owner']::public.party_role[])) or (d.visibility in ('buyer','shared') and private.has_portal_access(d.transaction_id,array['accepted_buyer']::public.party_role[]))))
);
create policy transaction_documents_internal_insert on storage.objects for insert to authenticated with check (
  bucket_id='transaction-documents' and exists(select 1 from public.documents d where d.storage_path=name and private.can_manage_transaction(d.transaction_id))
);
create policy transaction_documents_internal_update on storage.objects for update to authenticated using (
  bucket_id='transaction-documents' and exists(select 1 from public.documents d where d.storage_path=name and private.can_manage_transaction(d.transaction_id))
) with check (
  bucket_id='transaction-documents' and exists(select 1 from public.documents d where d.storage_path=name and private.can_manage_transaction(d.transaction_id))
);
create policy transaction_documents_internal_delete on storage.objects for delete to authenticated using (
  bucket_id='transaction-documents' and exists(select 1 from public.documents d where d.storage_path=name and private.can_manage_transaction(d.transaction_id))
);
