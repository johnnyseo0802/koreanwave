-- Read-only post-migration verification queries.
-- Do not run these until the migration has been applied to a non-production
-- environment. None of these statements create, update, or delete data.

-- 1. Verify the expected profile columns, nullability, and defaults.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;

-- 2. Verify RLS is enabled.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'profiles';

-- 3. Verify only the two owner policies exist for the MVP.
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;

-- 4. Verify table privileges do not give anon access and authenticated has no
-- INSERT or DELETE table privilege.
select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- 5. Verify authenticated UPDATE is limited to editable profile columns.
select
  grantee,
  column_name,
  privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;

-- 6. Verify both expected triggers are attached.
select
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_timing
from information_schema.triggers
where (event_object_schema = 'public' and event_object_table = 'profiles')
   or (event_object_schema = 'auth' and event_object_table = 'users')
order by event_object_schema, event_object_table, trigger_name;
