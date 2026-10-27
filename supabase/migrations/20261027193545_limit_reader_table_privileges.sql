-- Supabase's default privileges give authenticated every table privilege. Readers need only
-- select, insert, update and delete, which the policies check. TRUNCATE in particular skips
-- row-level security, so take back everything else.
revoke truncate, references, trigger, maintain
  on public.saved_words, public.reader_state, public.reading_days
  from authenticated;
