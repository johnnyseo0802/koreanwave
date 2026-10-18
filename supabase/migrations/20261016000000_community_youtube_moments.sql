-- Review draft only. Existing photos and moderation lifecycle remain unchanged.
begin;
alter table public.community_posts
  add column youtube_video_id text,
  add column youtube_title text,
  add column youtube_channel_name text,
  add constraint community_posts_youtube_metadata_check check (
    (youtube_video_id is null and youtube_title is null and youtube_channel_name is null)
    or (youtube_video_id is not null and youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
      and type='moment' and image_id is null and image_alt is null
      and youtube_title is not null and char_length(btrim(youtube_title)) between 1 and 300
      and youtube_channel_name is not null and char_length(btrim(youtube_channel_name)) between 1 and 200)
  );
-- Replace only the media/type shape CHECK from Sprint 9.1, not RLS or triggers.
alter table public.community_posts drop constraint community_posts_check,
  add constraint community_posts_check check (
    (type='moment' and ((image_id is not null and youtube_video_id is null) or (image_id is null and youtube_video_id is not null))
      and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g'))<=500)
    or (type='story' and title is not null and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g'))>=20)
    or (type='tip' and title is not null and topic is not null and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g')) between 10 and 5000)
    or (type='discussion' and title is not null and image_id is null and char_length(regexp_replace(body,'^[[:space:]]+|[[:space:]]+$','','g')) between 2 and 2000)
  );
grant select(youtube_video_id,youtube_title,youtube_channel_name) on public.community_posts to anon,authenticated;
grant insert(youtube_video_id,youtube_title,youtube_channel_name) on public.community_posts to authenticated;
-- No UPDATE grants, elevated functions, Storage or moderation changes.
commit;
