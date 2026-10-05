create function private.can_read_transaction_document(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.documents document
    where document.storage_path = p_storage_path
      and (
        private.is_org_member(document.organization_id)
        or (
          document.visibility in ('seller', 'shared')
          and private.has_portal_access(
            document.transaction_id,
            array['seller', 'co_owner']::public.party_role[]
          )
        )
        or (
          document.visibility in ('buyer', 'shared')
          and private.has_portal_access(
            document.transaction_id,
            array['accepted_buyer']::public.party_role[]
          )
        )
      )
  );
$$;

revoke all on function private.can_read_transaction_document(text)
  from public, anon;
grant execute on function private.can_read_transaction_document(text)
  to authenticated;

drop policy if exists transaction_documents_internal_read on storage.objects;
drop policy if exists transaction_documents_customer_read on storage.objects;

create policy transaction_documents_authorized_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'transaction-documents'
  and private.can_read_transaction_document(name)
);

comment on function private.can_read_transaction_document(text) is
  'Auth-bound Storage predicate for internal membership or transaction-scoped customer document visibility.';
