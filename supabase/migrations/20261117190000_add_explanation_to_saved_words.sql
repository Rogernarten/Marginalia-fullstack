-- Project v1: a word saved from "Explain" keeps a copy of the explanation, so the notebook
-- never calls the model again. Shape (lib/explain/core.ts, Explanation):
--   { kind: "word" | "context", meaning, background, sources: [...] }
-- Null for words saved any other way. The existing row-level security policies and table
-- privileges on saved_words cover the new column.
alter table public.saved_words
  add column explanation jsonb
  check (
    explanation is null
    or (jsonb_typeof(explanation) = 'object' and char_length(explanation::text) <= 4000)
  );
