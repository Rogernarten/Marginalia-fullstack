# Accessibility

What was checked, how, and what changed because of it. All checks ran against the dev build
(Next.js 16, Chrome headless) and are repeated on the live site before submission.

## How it was checked

- **Automated audit.** [axe-core](https://github.com/dequelabs/axe-core) 4.14 with the WCAG 2.2 AA
  and best-practice rules, on 11 pages and states: first visit, first visit with a note open,
  Welcome back, Contents, a chapter with your own word open, the resume offer, the notebook
  (empty and filled), the form showing errors, the bottom sheet on a 390px phone, and the
  not-found page. **0 violations.** The items axe marked for review were the decorative →
  arrows (hidden from screen readers) and the × close button, whose visible label is a symbol.
- **Keyboard only.** Tab through every page and check each stop is visible and shows the focus
  ring (6 pages, all pass), then do a whole visit without a mouse: open a note, save it, Esc
  back to the word, go to the notebook, add a note, change the weekly goal.
- **Reflow.** No sideways scrolling at 320px on seven routes.
- **Contrast.** Every color pair below is computed with `lib/contrast.ts` (the WCAG 2.x formula)
  from the values in `app/globals.css`.

## Contrast

Text needs 4.5:1. Underlines, borders, filled shapes and focus rings need 3:1.

| Foreground | Background | Used for | Ratio | Needs | |
|---|---|---|---|---|---|
| ink `#2a231c` | paper `#f6f1e7` | Body text, headings | 13.76:1 | 4.5:1 | Pass |
| ink `#2a231c` | surface `#fffdf8` | Text in cards, the margin and inputs | 15.24:1 | 4.5:1 | Pass |
| ink `#2a231c` | saved `#f3e2ae` | Shaded saved words, badges | 12.02:1 | 4.5:1 | Pass |
| muted `#6b5d4d` | paper `#f6f1e7` | Secondary text, hints | 5.66:1 | 4.5:1 | Pass |
| muted `#6b5d4d` | surface `#fffdf8` | Hints and labels inside cards | 6.26:1 | 4.5:1 | Pass |
| white `#ffffff` | accent `#2f5d46` | Primary button | 7.57:1 | 4.5:1 | Pass |
| white `#ffffff` | accent-strong `#234836` | Primary button, hover | 10.24:1 | 4.5:1 | Pass |
| danger `#a3312a` | paper `#f6f1e7` | Form errors | 6.16:1 | 4.5:1 | Pass |
| danger `#a3312a` | surface `#fffdf8` | Errors inside cards (notebook, margin) | 6.82:1 | 4.5:1 | Pass |
| surface `#fffdf8` | ink `#2a231c` | Toast text | 15.24:1 | 4.5:1 | Pass |
| saved `#f3e2ae` | ink `#2a231c` | Toast link | 12.02:1 | 4.5:1 | Pass |
| edge `#8c7b66` | paper `#f6f1e7` | Input and button borders on the page | 3.63:1 | 3:1 | Pass |
| edge `#8c7b66` | surface `#fffdf8` | Button and input borders inside cards | 4.02:1 | 3:1 | Pass |
| context `#9a5424` | paper `#f6f1e7` | Dotted underline (Then & now) | 5.09:1 | 3:1 | Pass |
| word `#2f5d46` | paper `#f6f1e7` | Dashed underline (Word) | 6.72:1 | 3:1 | Pass |
| context `#9a5424` | saved `#f3e2ae` | Dotted underline once saved | 4.44:1 | 3:1 | Pass |
| accent `#2f5d46` | surface `#fffdf8` | Filled day in This week | 7.44:1 | 3:1 | Pass |
| ink `#2a231c` | paper `#f6f1e7` | Focus ring | 13.76:1 | 3:1 | Pass |
| surface `#fffdf8` | ink `#2a231c` | Focus ring inside the toast | 15.24:1 | 3:1 | Pass |
| rule `#ddd2bf` | paper `#f6f1e7` | Dividers between sections | 1.33:1 | n/a | Decorative only, never a control's only edge |

## Keyboard

| Key | Where | What it does |
|---|---|---|
| Tab, Shift+Tab | Everywhere | Move between links, buttons, fields and words in the text |
| Tab, then Enter | Top of every page | “Skip to content” jumps past the navigation |
| Enter or Space | An underlined or shaded word | Opens its note in the margin (a sheet on phones) and moves focus there |
| Esc | An open note | Closes it and puts focus back on the word |
| Esc | Editing your note | Cancels the edit only; the note stays open |
| Enter | Save to notebook (form) | Checks every field; focus moves to the first one with an error |

## Other decisions

- **Real labels.** Every field has a visible `<label>`. Hints and errors are linked with
  `aria-describedby`, invalid fields get `aria-invalid`, and the one required field is marked
  `required`. Errors say what to do next.
- **Not color alone.** The two kinds of note use different underline styles (dotted, dashed) and
  a legend; saved words are shaded and the note says “In your notebook”; errors have an icon and
  text; reading days have a check mark and a text description.
- **Announcements.** Saving or removing a word is announced through a `role="status"` region, and
  so is the toast after the form saves.
- **Focus is never lost.** When a button is replaced (Save → Undo → Remove), focus moves to the
  new one. Closing a note returns focus to its word, or to its paragraph if the word was removed.
- **Reduced motion.** With `prefers-reduced-motion`, loading placeholders don't pulse and the
  paragraph you jump to is tinted instead of flashing.
- **Targets.** Buttons and links are at least 44px tall. Words in the text are inline, which WCAG
  2.5.8 exempts from the target size.
- **Structure.** One `h1` per page, a title per route, `lang="en"`, and landmarks for the
  navigation, main content and the margin.

## Fixed during this check

- The top navigation and the chapter links overflowed at 320px; they now wrap and tighten.
- The Contents badges (“Guide notes”, “You're here”) pushed rows wider than a small phone; they
  now wrap under the chapter.
- Loading placeholders used `aria-label` on a plain `div`; they're now a `role="status"` with
  readable “Loading…” text.
- The week's day circles were a list whose items were all hidden from screen readers; they're now
  one image with a sentence (“Read on Monday and Wednesday.”).
- The word field in the form is now marked `required` for screen readers (the form still uses
  its own messages, not the browser's).
