# FF Hub

A local fantasy football dashboard: Sleeper league browser, trade calculator, and a
starters-vs-bench lineup checker.

## Setup

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Using it

1. **Connect** — enter your Sleeper username, click *Find Leagues*, pick the league
   and your team from the dropdowns, then *Load League*. This pulls your rosters
   straight from Sleeper's public API (no login/API key needed).
2. **Starters** — Boone (and JJZ) publish one *ranked list* per position, so
   upload/paste is per-position too: pick QB/RB/WR/TE/K/DEF from the dropdown,
   then paste or upload just that position's list (a simple `Rank, Player` list
   is fine, or a fuller `Rank, Player, Team, Position` table — headers are
   auto-detected). Repeat for each position you have; each upload only replaces
   that position's slice, so earlier positions stay loaded. Below the upload
   boxes you'll see suggested starter/bench swaps and a full side-by-side
   ranking table for your loaded team.
3. **Trade Calculator** — this uses a *different* Boone product: his separate
   "Trade Value Chart" pages, one per position, with **Player, HALF, PPR**
   columns (HALF = 0.5 PPR; his QB chart uses **1QB, 2QB** instead - roster
   format matters more than scoring format for QB value - 1QB is used by
   default). Pick a position, then either paste the article's URL and click
   *Load from URL* (these pages are server-rendered with a real HTML table,
   so this fetches and parses it directly - no copy/paste needed), or fall
   back to pasting/uploading the table yourself if a URL doesn't work.
   Repeat per position. Then search for any rostered player in the loaded
   league on either side (Giving / Receiving) and see each side's total
   value (his numbers, summed) and a verdict on how even the trade is.

## Two different Boone pages — don't mix them up

Boone publishes these as separate Yahoo articles, and this app treats them as
two separate uploads on two separate tabs:

- **Rankings** ("Fantasy Football [Position] Rankings") — just an ordered
  list, used on the **Starters** tab to compare your starters against your
  bench within/across eligible positions.
- **Trade Value Chart** ("Trade Value Chart... [Position] Breakdown") — a
  Player/HALF/PPR table where the numbers are already normalized to be
  compared across positions, used on the **Trade Calculator** tab.

They aren't interchangeable — a ranking (e.g. "RB #5") has no fixed value on
its own, while a trade chart's HALF number is a value already scaled to be
comparable against every other position's HALF numbers.

## Notes

- Only the Trade Value Chart pages are scraped by URL, and only because
  they're actually server-rendered with a real `<table>` in the raw HTML
  (verified directly - no JS execution needed, so no headless browser or
  CORS proxy required either; the fetch happens in the Node backend, which
  has no CORS restriction to begin with). His rankings pages are prose
  articles with no table markup at all, so those stay paste/upload-only -
  there's no reliable shortcut there. `server/scrape.js` only allows
  `sports.yahoo.com` URLs.
- The Starters tool's swap suggestions still need to compare *ranks* across
  positions (e.g. is a bench RB better than a starting TE?), even though a
  ranking source's rank is only meaningful *within* its own position.
  `server/tradeValue.js`'s `valueForPlayer` bridges this with a positional
  weight (RB/WR highest, TE next, QB discounted for single-QB leagues, K/DEF
  near zero) on top of a diminishing-returns rank curve — tune
  `POSITION_WEIGHTS` or `CURVE_EXPONENT` there if it feels off, and bump QB's
  weight toward 1.0 if your league is superflex/2QB. The Trade Calculator
  doesn't use this curve at all — it just sums Boone's own HALF values.
- All cached Sleeper data and uploaded rankings/trade values live in `data/`
  (gitignored) — delete that folder any time to reset local state.
