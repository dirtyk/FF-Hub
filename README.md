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
2. **Starters** — upload or paste Justin Boone's Yahoo rankings (0.5 PPR) and/or
   JJ Zachariason's rankings. Expected format is a `Rank, Player, Team, Position`
   table (CSV, tab-separated, or pasted straight from a page) — headers are
   detected automatically and columns can be in any order. Re-upload any time to
   refresh. Below the upload boxes you'll see suggested starter/bench swaps and a
   full side-by-side ranking table for your loaded team.
3. **Trade Calculator** — search for any rostered player in the loaded league on
   either side (Giving / Receiving), and see each side's total trade value (from
   Boone's rankings) and a verdict on how even the trade is.

## Notes

- Rankings are uploaded, not scraped: Yahoo's rankings tables render client-side
  via JavaScript, so a plain scraper is fragile and could violate automated-access
  terms. Uploading/pasting is reliable and works for any rankings source, not just
  Yahoo's.
- All cached Sleeper data and uploaded rankings live in `data/` (gitignored) —
  delete that folder any time to reset local state.
- The trade value curve (`server/tradeValue.js`) is a simple diminishing-returns
  function of overall rank; tweak `CURVE_EXPONENT` there if values feel off.
