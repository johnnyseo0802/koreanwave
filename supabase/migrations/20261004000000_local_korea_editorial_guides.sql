-- Launch 1B: review and apply separately. No data writes or remote execution.
-- Forward-only expansion of the existing editorial classification, not local entities.
begin;

-- Replacement is atomic: an error rolls back to the original constraint.
-- All previously valid rows remain valid. Validation scans existing articles;
-- ALTER TABLE takes a lock, so apply during an appropriate maintenance window.
alter table public.editorial_articles
  drop constraint editorial_articles_category_check,
  add constraint editorial_articles_category_check check (
    (section = 'k-contents' and category in ('music', 'dramas', 'movies'))
    or (section = 'k-trends' and category in ('beauty', 'fashion', 'food'))
    or (section = 'local-korea' and category = 'guides')
  );

-- No RLS, grants, timestamp lifecycle, indexes, functions or other tables change.
-- No seed data. Apply through migration tracking once; do not roll back to the
-- old constraint after Guides exist without a separate reviewed content plan.
commit;

-- Read-only verification after operator application:
-- select pg_get_constraintdef(oid) from pg_constraint
-- where conrelid = 'public.editorial_articles'::regclass
-- and conname = 'editorial_articles_category_check';
