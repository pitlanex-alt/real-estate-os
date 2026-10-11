alter table public.profiles
  add column if not exists profile_photo_source_path text,
  add column if not exists profile_photo_crop_x double precision not null default 0,
  add column if not exists profile_photo_crop_y double precision not null default 0,
  add column if not exists profile_photo_crop_zoom double precision not null default 1;

alter table public.profiles
  drop constraint if exists profiles_profile_photo_crop_x_check,
  add constraint profiles_profile_photo_crop_x_check
    check (profile_photo_crop_x between -1 and 1),
  drop constraint if exists profiles_profile_photo_crop_y_check,
  add constraint profiles_profile_photo_crop_y_check
    check (profile_photo_crop_y between -1 and 1),
  drop constraint if exists profiles_profile_photo_crop_zoom_check,
  add constraint profiles_profile_photo_crop_zoom_check
    check (profile_photo_crop_zoom between 1 and 3);

-- Portal users may receive the optimized avatar, never the retained source.
drop policy if exists agency_assets_customer_agent_read on storage.objects;
create policy agency_assets_customer_agent_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agency-assets'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[3] = 'profiles'
  and storage.filename(name) = 'avatar.webp'
  and private.can_read_agent_profile_photo(
    (storage.foldername(name))[2]::uuid,
    (storage.foldername(name))[4]::uuid
  )
);

create or replace function public.update_own_profile_with_photo(
  p_display_name text,
  p_professional_title text,
  p_phone text,
  p_email extensions.citext,
  p_profile_photo_path text default null,
  p_profile_photo_source_path text default null,
  p_profile_photo_crop_x double precision default null,
  p_profile_photo_crop_y double precision default null,
  p_profile_photo_crop_zoom double precision default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.profiles%rowtype;
  v_photo_org uuid;
  v_source_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if nullif(trim(p_display_name), '') is null then
    raise exception 'Display name is required' using errcode = '22023';
  end if;

  if p_profile_photo_path is not null then
    if (storage.foldername(p_profile_photo_path))[1] <> 'organizations'
      or (storage.foldername(p_profile_photo_path))[3] <> 'profiles'
      or (storage.foldername(p_profile_photo_path))[4] <> auth.uid()::text then
      raise exception 'Invalid profile photo path' using errcode = '22023';
    end if;
    v_photo_org := (storage.foldername(p_profile_photo_path))[2]::uuid;
    if not private.is_org_member(v_photo_org) then
      raise exception 'Organization access required' using errcode = '42501';
    end if;
    if p_profile_photo_crop_x is null
      or p_profile_photo_crop_y is null
      or p_profile_photo_crop_zoom is null then
      raise exception 'Crop values are required' using errcode = '22023';
    end if;
  end if;

  if p_profile_photo_source_path is not null then
    if (storage.foldername(p_profile_photo_source_path))[1] <> 'organizations'
      or (storage.foldername(p_profile_photo_source_path))[3] <> 'profiles'
      or (storage.foldername(p_profile_photo_source_path))[4] <> auth.uid()::text then
      raise exception 'Invalid profile photo source path' using errcode = '22023';
    end if;
    v_source_org := (storage.foldername(p_profile_photo_source_path))[2]::uuid;
    if not private.is_org_member(v_source_org)
      or (v_photo_org is not null and v_source_org <> v_photo_org) then
      raise exception 'Organization access required' using errcode = '42501';
    end if;
  end if;

  update public.profiles
  set
    display_name = trim(p_display_name),
    professional_title = nullif(trim(p_professional_title), ''),
    phone = nullif(trim(p_phone), ''),
    email = nullif(trim(p_email::text), '')::extensions.citext,
    profile_photo_path = coalesce(nullif(trim(p_profile_photo_path), ''), profile_photo_path),
    profile_photo_source_path = case
      when p_profile_photo_path is null then profile_photo_source_path
      else coalesce(nullif(trim(p_profile_photo_source_path), ''), profile_photo_source_path)
    end,
    profile_photo_crop_x = coalesce(p_profile_photo_crop_x, profile_photo_crop_x),
    profile_photo_crop_y = coalesce(p_profile_photo_crop_y, profile_photo_crop_y),
    profile_photo_crop_zoom = coalesce(p_profile_photo_crop_zoom, profile_photo_crop_zoom)
  where id = auth.uid()
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.update_own_profile_with_photo(
  text, text, text, extensions.citext, text, text,
  double precision, double precision, double precision
) from public, anon;
grant execute on function public.update_own_profile_with_photo(
  text, text, text, extensions.citext, text, text,
  double precision, double precision, double precision
) to authenticated;

comment on column public.profiles.profile_photo_source_path is
  'Private original source used to reproduce and edit the avatar crop.';
comment on column public.profiles.profile_photo_crop_x is
  'Normalized horizontal crop position from -1 to 1.';
comment on column public.profiles.profile_photo_crop_y is
  'Normalized vertical crop position from -1 to 1.';
comment on column public.profiles.profile_photo_crop_zoom is
  'Crop zoom multiplier from 1 to 3.';
