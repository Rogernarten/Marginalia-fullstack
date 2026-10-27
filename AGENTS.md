<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Marginalia

A reading companion for Pride and Prejudice (Design, Build, Ship · Assignment 3). Readers tap
underlined words and period details to see layered hints, save words to a notebook, and come
back to pick up where they stopped and keep a weekly reading goal. Flows live in `flows.md`.

## Constraints

- No database, accounts, backend, server actions or external APIs. Everything a reader saves
  lives in localStorage under one key, `marginalia:v1`, read and written only through
  `lib/storage.ts`.
- The hints are static data written ahead of time (`lib/notes/`), not generated at runtime.
  Hints explain; they never give a straight translation.
- Book text is Project Gutenberg #1342 in `public/book/NN.json` (one array of paragraphs per
  chapter), built by `scripts/build-book.mjs`. Italics are marked `_like this_`.
- Push back on new packages. Next.js and Tailwind are the stack.

## Conventions

- Build every screen from the shared components in `components/ui/`. Don't hand-style a
  button, input or field inside a page.
- Every field has a visible `<label>`. Errors sit under their field, are linked with
  `aria-describedby`, and say what to do next ("Enter the word or phrase you want to save."),
  never "Invalid input". Keep what the person typed when there's an error.
- Everything works with a keyboard, with the shared `focus-visible` ring. Check new colors with
  `lib/contrast.ts` (4.5:1 for text, 3:1 for UI boundaries).
- Never interrupt reading with pop-ups. Streaks and goals stay on the home page.
