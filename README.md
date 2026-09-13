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
2. **Starters** — Boone (and JJZ) publish one ranked list *per position*, so
   upload/paste is per-position too: pick QB/RB/WR/TE/K/DEF from the dropdown,
   then paste or upload just that position's list (a simple `Rank, Player` list
   is fine, or a fuller `Rank, Player, Team, Position` table — headers are
   auto-detected). Repeat for each position you have; each upload only replaces
   that position's slice, so earlier positions stay loaded. Re-upload a position
   any time to refresh it. Below the upload boxes you'll see suggested
   starter/bench swaps and a full side-by-side ranking table for your loaded team.
3. **Trade Calculator** — search for any rostered player in the loaded league on
   either side (Giving / Receiving), and see each side's total trade value (from
   Boone's rankings) and a verdict on how even the trade is.

## Notes

- Rankings are uploaded, not scraped: Yahoo's rankings tables render client-side
  via JavaScript, so a plain scraper is fragile and could violate automated-access
  terms. Uploading/pasting is reliable and works for any rankings source, not just
  Yahoo's.
- Trade value and starter/bench swap suggestions both need to compare players
  *across* positions (e.g. is a bench RB better than a starting TE?), but a
  ranking source's rank is only meaningful *within* its own position (its
  "RB #5" and "TE #5" aren't equivalent). `server/tradeValue.js` bridges this
  with a positional weight (RB/WR highest, TE next, QB discounted for
  single-QB leagues, K/DEF near zero) on top of a diminishing-returns rank
  curve — tune `POSITION_WEIGHTS` or `CURVE_EXPONENT` there if values feel off,
  and bump QB's weight toward 1.0 if your league is superflex/2QB.
- All cached Sleeper data and uploaded rankings live in `data/` (gitignored) —
  delete that folder any time to reset local state.
