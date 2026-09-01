# Flashcard Study

**Live page: https://hclx.github.io/FlashCard/**

A flashcard game that runs entirely in the browser — no backend, no build step.
Content is organized into **domains**: self-contained folders you can add,
remove, or hand to someone else without touching any code.

## Try it locally

Because the app loads JSON with `fetch()`, opening `index.html` directly
(`file://...`) will fail in most browsers due to CORS restrictions on local
files. Serve the folder instead:

```bash
cd flashcard-game
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publish on GitHub Pages

1. Push this folder to a GitHub repo (the contents of `flashcard-game/`,
   including `index.html`, should be at the repo root, or in `/docs`).
2. In the repo, go to **Settings → Pages**, and set the source to the branch
   and folder you pushed to.
3. GitHub will give you a URL like `https://username.github.io/repo-name/`.
   That's it — no build step, no server config.

## Adding a new domain (deck of cards)

Every domain is a folder under `domains/`. To add one:

1. Copy `domains/_template/` to a new folder, e.g. `domains/french-basics/`.
2. Edit `domain.json` inside it:

   ```json
   {
     "id": "french-basics",
     "name": "French Basics",
     "description": "One sentence describing the deck.",
     "icon": "🥐",
     "color": "#2F6F62",
     "cardsFile": "cards.json"
   }
   ```

   - `id` should be unique and match the folder name — it's used to store
     best-score progress in the browser.
   - `icon` is any emoji or short text shown on the deck's card.
   - `color` is currently unused by the UI but reserved for future per-deck
     theming.

3. Edit `cards.json` — an array of cards. Only `id`, `front`, and `back` are
   required:

   ```json
   [
     { "id": "fr-01", "front": "Bonjour", "back": "Hello" },
     {
       "id": "fr-02",
       "front": "Merci",
       "back": "Thank you",
       "hint": "Say it often",
       "image": "resources/merci.png",
       "info": "From Latin 'mercedem' (reward/wages) — the same root gives English 'mercy' and 'mercantile'."
     }
   ]
   ```

   - `hint` (optional) shows on the front of the card, for learners who get
     stuck. It's hidden when the front is the expected *answer* (see
     bidirectional quizzing below), since showing it would give the answer
     away.
   - `image` (optional) is a path *relative to the domain's own folder* —
     put image/audio files in that domain's `resources/` folder and
     reference them from there. Also hidden in the same case as `hint`.
   - `info` (optional) shows once you've answered, right or wrong — a
     short note on why the answer is what it is (etymology, a naming
     rule, a mnemonic), rather than a hint for getting there.
   - `id` should be unique **within the domain**. It's used to track each
     card's mastery streak during a session.

4. Register the folder in `domains/manifest.json`:

   ```json
   { "domains": ["chemistry-ap", "french-basics"] }
   ```

   Static hosting (including GitHub Pages) can't list a folder's contents at
   runtime, which is why this manifest exists — it's the one place that
   needs updating when you add or remove a domain.

That's the whole workflow. No JavaScript, build tools, or server code is
required to add content — a non-technical contributor can add a domain by
copying a folder and editing two JSON files.

## How a study session works

Each card shows its `front` text; you type the answer and hit **Check**
(or Enter). It's a quiz, not a flip-card review:

- A **correct** answer scores +1 point. An **incorrect or empty** answer
  scores -1 point and reveals the right answer — if the grader was too
  strict about wording, click **"Actually, I was right"** to flip it.
- Grading is forgiving about case, punctuation, and parenthetical notes
  (e.g. `Iron (II) or ferrous` accepts "iron" or "ferrous").
- Cards you get wrong come back **sooner** than cards you get right, so
  weak spots repeat more often — this is the "mastery streak" setting on
  the deck picker: a card needs that many **correct answers in a row**
  before it's considered mastered and drops out of the rotation.
- The session ends once every card in the deck has been mastered.
- **Skip** sets the current card aside without scoring it. The
  **Shuffle** checkbox randomizes the starting order.
- Your best score per deck is remembered in the browser via
  `localStorage` — nothing leaves your machine.

### Bidirectional quizzing

The **"Quiz both directions"** checkbox on the deck picker (on by default)
randomizes, for each card, whether you're shown the `front` and asked for
the `back`, or shown the `back` and asked for the `front`. A hint or image
only appears when `front` is the prompt — showing it when `front` is the
expected *answer* would give it away.

### Typing chemical symbols and formulas

When the expected answer looks like a formula (it contains a digit or a
charge sign), the grader switches to a formula-aware mode so you don't need
to type actual Unicode sub/superscript characters — plain keys are enough:

- Digits: type them normally. `H2O` matches `H₂O`.
- Charges: use a trailing `+`/`-`, with the number before or after it.
  `Fe2+`, `Fe+2`, and `Fe^2+` all match `Fe²⁺`.
- Spaces and `^` are ignored, so `SO4 2-` and `SO4^2-` both match `SO₄²⁻`.

This mode is case-insensitive. A tip with a live example appears under the
input whenever it's active, so the convention doesn't need to be memorized.

## Project structure

```
flashcard-game/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── deck-loader.js      # reads manifest.json + each domain's JSON
│   ├── flashcard-game.js   # session state: queue, scoring, requeueing
│   └── app.js              # DOM wiring, view switching, localStorage
└── domains/
    ├── manifest.json       # list of domain folder names
    ├── _template/          # copy this to start a new domain
    └── chemistry-ap/
        ├── domain.json
        └── cards.json
```
