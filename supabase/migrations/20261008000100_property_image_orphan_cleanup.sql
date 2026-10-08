-- Allow authorized internal operators to remove a just-uploaded property image
-- if metadata creation fails. Tenant and role checks remain identical to upload.
drop policy if exists property_images_storage_delete on storage.objects;
create policy property_images_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'property-images'
  and (
    exists (
      select 1
      from public.property_images image
      where image.storage_path = name
        and private.can_operate_organization(image.organization_id)
    )
    or (
      (storage.foldername(name))[1] = 'organizations'
      and (storage.foldername(name))[3] = 'properties'
      and private.can_operate_organization((storage.foldername(name))[2]::uuid)
      and exists (
        select 1
        from public.properties property
        where property.organization_id = (storage.foldername(name))[2]::uuid
          and property.id = (storage.foldername(name))[4]::uuid
      )
    )
  )
);
