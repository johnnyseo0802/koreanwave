-- DRAFT ONLY: review/apply separately. No existing rows are rewritten.
-- Requires migrations through 20260925000000. No Auth/private-data policy changes.
begin;

-- No conflict-ignore: abort if an unmanaged bucket already has this name.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 2097152, array['image/jpeg','image/png','image/webp']);
-- Public object delivery is provided by this public bucket, NOT a global SELECT
-- policy. Only admins may list object metadata. All files must be public-safe,
-- including files attached to drafts; unpublishing does not revoke image URLs.
create policy site_media_admin_select on storage.objects for select to authenticated
using (bucket_id = 'site-media' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy site_media_admin_insert on storage.objects for insert to authenticated

with check (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy site_media_insert_guard on storage.objects as restrictive for insert to authenticated

with check (bucket_id <> 'site-media' or (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')));

create policy site_media_admin_update on storage.objects for update to authenticated
using (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
with check (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy site_media_update_guard on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'site-media' or (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')))
with check (bucket_id <> 'site-media' or (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')));

create policy site_media_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
;
create policy site_media_delete_guard on storage.objects as restrictive for delete to authenticated
using (bucket_id <> 'site-media' or (bucket_id = 'site-media' and name ~ '^images/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')))
;
alter table public.editorial_articles add column image_alt text check (image_alt is null or char_length(image_alt) <= 240);
grant select (image_url, image_alt) on public.editorial_articles to anon, authenticated;
grant insert (image_alt) on public.editorial_articles to authenticated;
grant update (image_alt) on public.editorial_articles to authenticated;

alter table public.places add column image_url text check (image_url is null or (char_length(image_url) <= 2048 and image_url ~ '^https://[^[:space:]]+$'));
alter table public.places add column image_alt text check (image_alt is null or char_length(image_alt) <= 240);
grant select (image_url, image_alt) on public.places to anon, authenticated;
-- Existing timestamp trigger remains authoritative. No creation/deletion/date editing.
grant select (updated_at) on public.places to authenticated;
grant update (name, area, category, description, visitor_info, status, image_url, image_alt) on public.places to authenticated;
create policy places_admin_read_all on public.places for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy places_admin_edit on public.places for update to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

alter table public.experiences add column image_url text check (image_url is null or (char_length(image_url) <= 2048 and image_url ~ '^https://[^[:space:]]+$'));
alter table public.experiences add column image_alt text check (image_alt is null or char_length(image_alt) <= 240);
grant select (image_url, image_alt) on public.experiences to anon, authenticated;
-- Existing timestamp trigger remains authoritative. No creation/deletion/date editing.
grant select (updated_at) on public.experiences to authenticated;
grant update (name, area, category, description, visitor_info, status, image_url, image_alt) on public.experiences to authenticated;
create policy experiences_admin_read_all on public.experiences for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy experiences_admin_edit on public.experiences for update to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

alter table public.events add column image_url text check (image_url is null or (char_length(image_url) <= 2048 and image_url ~ '^https://[^[:space:]]+$'));
alter table public.events add column image_alt text check (image_alt is null or char_length(image_alt) <= 240);
grant select (image_url, image_alt) on public.events to anon, authenticated;
-- Existing timestamp trigger remains authoritative. No creation/deletion/date editing.
grant select (updated_at) on public.events to authenticated;
grant update (title, description, public_area, category, participation_info, cancellation_policy, status, image_url, image_alt) on public.events to authenticated;
create policy events_admin_read_all on public.events for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy events_admin_edit on public.events for update to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- Anonymous guards avoid querying profiles (anon deliberately has no SELECT).
create policy site_media_anon_insert_guard on storage.objects as restrictive
for insert to anon with check (bucket_id <> 'site-media');
create policy site_media_anon_update_guard on storage.objects as restrictive
for update to anon using (bucket_id <> 'site-media') with check (bucket_id <> 'site-media');
create policy site_media_anon_delete_guard on storage.objects as restrictive
for delete to anon using (bucket_id <> 'site-media');

-- No search index: bounded literal ILIKE queries are adequate for the initial
-- dozens of records. Review EXPLAIN on staging before adding pg_trgm at scale.
-- Security: table grants remain column-specific, member mutations denied by RLS,
-- timestamps controlled by existing triggers; no access changes to applications,
-- meeting details, profiles, questions, answers or reviews.
-- Review in staging: anon/member/admin write matrix, image MIME/size/path denial,
-- draft SELECT denial, stale UPDATE, private meeting details unchanged.
-- Rollback requires disabling new UI first; revoke these added column grants and
-- remove only these named policies/columns after reviewing retained data. Delete
-- storage objects via the Storage API, not SQL; never drop storage.objects.
commit;
