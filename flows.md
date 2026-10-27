# Flows

**The main task, in one sentence:**
I tap a word I don't know → I see what it meant in 1813 and save it to my notebook →
I come back on Sunday, see my week, and pick up where I stopped.

```mermaid
flowchart TD
  open(["Open Marginalia"]) --> saved{"Anything saved<br/>on this device?"}
  saved -- No --> ch1
  saved -- Yes --> home

  subgraph first["1 · First visit: useful right away"]
    ch1["/ · Chapter 1 opens with underlines on<br/>Tip: Tap an underlined word"] --> tap["Tap “Michaelmas”"]
    tap --> margin["Margin: one-line hint<br/>→ More → Word notes"]
    margin --> quick["Save to notebook"]
    quick --> toast["“In your notebook” · Undo<br/>the word turns shaded"]
  end

  subgraph task["2 · Main task: save a word"]
    read["/read/N · reading a chapter"] --> under{"Is the word<br/>underlined?"}
    under -- Yes --> margin
    under -- No --> look["Look it up<br/>Wikipedia in the margin"]
    look --> found{"Wikipedia"}
    found -- Found --> wsave["Summary · More · From Wikipedia<br/>Save “curricle” to notebook"]
    found -- Several meanings --> amb["“Bath” means several things.<br/>Try a more specific phrase"]
    found -- Nothing / down --> add
    under -- No --> add["+ Add a word<br/>/notebook/new, selected text filled in"]
    add --> form["Form: Word or phrase · Chapter · Your note"]
    form --> check{"Check"}
    check -- Empty --> e1["“Enter the word or phrase you want to save.”"]
    check -- Not in chapter --> e2["“We couldn't find ‘ential’ in Chapter 2.<br/>Check the spelling, or pick another chapter.”"]
    check -- Note too long --> e4["“Shorten your note to 280 characters or fewer.”"]
    e1 & e2 & e4 -- "what they typed stays" --> form
    check -- Already saved --> e3["“‘entail’ is already in your notebook.<br/>Open it to add a note.”"]
    check -- OK --> nb["/notebook · “Saved ‘wilful’”<br/>Back to Chapter N"]
    e3 --> nb
  end

  subgraph back["3 · Coming back: it remembers"]
    home["/ · Welcome back"] --> cont["Continue · Chapter 2, ¶9"]
    home --> week{"This week<br/>vs. goal"}
    week -- On track --> on["“2 of 3 days · 3 weeks in a row”"]
    week -- Missed last week --> fresh["“New week, fresh start: 0 of 3 days.”"]
    home --> recent["Your last 3 words → /notebook"]
  end

  toast --> next["Keep reading → Chapter 2"] --> read
  cont --> read
  read -. "5 minutes of reading = 1 day" .-> week
```

## States

| State | What the reader sees |
|---|---|
| Loading saved data | A neutral page skeleton, never a flash of the first-visit screen |
| Notebook empty | "No words yet. Tap an underlined word in Chapter 1 to save it." and Start reading |
| Browser can't save (private mode, storage full) | "This browser isn't saving right now, so your words will be gone when you close the tab." |
| Chapter that doesn't exist (`/read/99`) | "Pride and Prejudice has 61 chapters." and a link to Contents |
| Saved data can't be read | Start fresh without crashing |
| Looking up on Wikipedia | Skeleton lines in the margin; screen readers hear “Looking up “curricle” on Wikipedia…” |
| Wikipedia found it under another name | “Showing “Fee tail” for “entail”.” |
| Wikipedia: several meanings (`Bath`) | ““Bath” means several things on Wikipedia. Try a more specific phrase…” and a link to the list |
| Wikipedia: nothing found (`Meryton`) | “Wikipedia has no article on “Meryton”.” and + Add it with my note |
| Wikipedia down or slow (over 8 s) | “Wikipedia isn't answering right now.” Try again, or save it with your own note |
| Signed out and choosing Look it up | “Sign in to look things up on Wikipedia and keep them in your notebook.” and Sign in |
| Missed last week's goal | "Welcome back. New week, fresh start: 0 of 3 days." Continue reading stays on top |

## Pages

| Route | Step |
|---|---|
| `/` | First visit (Chapter 1) or Welcome back, decided once on load |
| `/read` | Contents |
| `/read/[chapter]` | Reading, with the margin |
| `/notebook/new` | The form: save a word (signed in only) |
| `/notebook` | The notebook (signed in only) |
| `/sign-in`, `/sign-up` | Clerk's forms |
| `GET /api/lookup?q=` | Wikipedia summary, signed in only |
