// Parses an uploaded/pasted rankings file (CSV-ish: Rank, Player, Team, Position
// in some header order) and matches each row to a Sleeper player_id, so the
// Starters tool can join rankings onto real rosters.
const { makeStore } = require('./positionedStore');

// Applied AFTER punctuation stripping below, so "Jr." has already lost its
// period by the time this runs - match trailing whitespace too, not just $,
// or "Travis Etienne Jr." (-> "travis etienne jr ") never matches Sleeper's
// suffix-less "Travis Etienne" (-> "travis etienne").
const SUFFIXES = /\b(jr|sr|ii|iii|iv|v)\.?\s*$/i;
const DST_WORDS = /\b(defense|dst|d\/st)\b/i;

function normalizeName(raw) {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // strip punctuation (periods, apostrophes, hyphens)
    .replace(SUFFIXES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePos(raw) {
  if (!raw) return '';
  const p = raw.toUpperCase().trim();
  if (p === 'D/ST' || p === 'DST' || p === 'DEF') return 'DEF';
  return p;
}

// Very small CSV line splitter that handles quoted fields with commas.
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectDelimiter(headerLine) {
  if (headerLine.includes('\t')) return '\t';
  return ',';
}

function findCol(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const cand of candidates) {
    const idx = lower.indexOf(cand);
    if (idx !== -1) return idx;
  }
  return -1;
}

// Bare header words we recognize when text has NO delimiter at all (see
// detectOneCellPerLine below).
const HEADER_WORD_RE = /^(rk|rank|overall|player|name|team|pos|position|half|ppr|value|tradevalue|1qb|2qb)$/i;

// Some sites' JS-rendered tables copy/paste as one cell per line rather than
// a delimited table (each header word on its own line, then every row's
// values each on their own line, in reading order). Detects that shape by
// finding a leading run of bare header words, then grouping the rest into
// same-sized rows; returns null if the text doesn't look like this. On
// success, `dataLines` are tab-joined so callers can reuse their normal
// splitLine(l) => l.split('\t') path unchanged.
function detectOneCellPerLine(lines) {
  let headerCount = 0;
  while (
    headerCount < lines.length &&
    lines[headerCount].length < 24 &&
    HEADER_WORD_RE.test(lines[headerCount])
  ) {
    headerCount++;
  }
  if (headerCount < 2) return null;
  const rest = lines.slice(headerCount);
  if (rest.length === 0 || rest.length % headerCount !== 0) return null;
  const headers = lines.slice(0, headerCount);
  const dataLines = [];
  for (let i = 0; i < rest.length; i += headerCount) {
    dataLines.push(rest.slice(i, i + headerCount).join('\t'));
  }
  return { headers, dataLines, splitLine: (l) => l.split('\t') };
}

// Parses raw pasted/uploaded text into rows: [{rank, name, pos, team}].
// fallbackPos is applied to any row whose own Position column is blank -
// used when the user is pasting a single position's list (e.g. Boone's
// separate QB/RB/WR/TE/K/DEF pages, which don't include a Position column
// at all) and picks the position from a dropdown instead.
function parseRankingsText(text, fallbackPos) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], warnings: ['Empty input.'] };

  const hasDelimiter = lines.some((l) => l.includes('\t') || l.includes(','));

  let headers, dataLines, splitLine;
  if (hasDelimiter) {
    const delim = detectDelimiter(lines[0]);
    splitLine = (l) => (delim === '\t' ? l.split('\t').map((s) => s.trim()) : splitCsvLine(l));
    const firstCells = splitLine(lines[0]);
    const looksLikeHeader = firstCells.some((c) =>
      /^(rank|player|name|team|pos|position|overall)/i.test(c)
    );
    if (looksLikeHeader) {
      headers = firstCells;
      dataLines = lines.slice(1);
    } else {
      // No header - assume "rank, player, team, pos" if 4 cols, else fall back
      headers = ['rank', 'player', 'team', 'pos'].slice(0, firstCells.length);
      dataLines = lines;
    }
  } else {
    const grouped = detectOneCellPerLine(lines);
    if (!grouped) {
      return {
        rows: [],
        warnings: [
          'Could not detect a table in the pasted text. If it came out scrambled, try pasting it as one value per line in reading order, starting with the header row (e.g. Rank, Player, then each row\'s values in order).',
        ],
      };
    }
    ({ headers, dataLines, splitLine } = grouped);
  }

  const rankCol = findCol(headers, ['rank', 'overallrank', 'ovrrank', 'ecr']);
  const nameCol = findCol(headers, ['player', 'playername', 'name']);
  const teamCol = findCol(headers, ['team', 'nflteam', 'tm']);
  const posCol = findCol(headers, ['pos', 'position']);

  const warnings = [];
  if (nameCol === -1) {
    warnings.push('Could not find a Player/Name column - check the file format.');
    return { rows: [], warnings };
  }

  const rows = [];
  dataLines.forEach((line, i) => {
    const cells = splitLine(line);
    const name = cells[nameCol];
    if (!name) return;
    const rank = rankCol !== -1 && cells[rankCol] ? parseInt(cells[rankCol], 10) : i + 1;
    const parsedPos = posCol !== -1 ? normalizePos(cells[posCol]) : '';
    rows.push({
      rank: Number.isFinite(rank) ? rank : i + 1,
      name: name.trim(),
      team: teamCol !== -1 ? (cells[teamCol] || '').trim() : '',
      pos: parsedPos || normalizePos(fallbackPos) || '',
    });
  });

  rows.sort((a, b) => a.rank - b.rank);
  return { rows, warnings };
}

// Builds a lookup index of Sleeper players by normalized name (and by
// normalized-name+position for disambiguation) from the players/nfl blob.
function buildPlayerIndex(players) {
  const byName = new Map();
  const byNamePos = new Map();
  for (const [id, p] of Object.entries(players)) {
    if (!p) continue;
    const isDst = p.position === 'DEF';
    const fullName = isDst
      ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.full_name
      : p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const n = normalizeName(fullName);
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push({ id, ...p });
    const posKey = `${n}|${normalizePos(p.position)}`;
    if (!byNamePos.has(posKey)) byNamePos.set(posKey, []);
    byNamePos.get(posKey).push({ id, ...p });
  }
  return { byName, byNamePos };
}

function matchRowToPlayer(row, index) {
  const n = normalizeName(DST_WORDS.test(row.name) ? row.name.replace(DST_WORDS, '').trim() : row.name);
  const posKey = `${n}|${row.pos}`;
  let candidates = row.pos ? index.byNamePos.get(posKey) : null;
  if (!candidates || candidates.length === 0) candidates = index.byName.get(n);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Disambiguate by team if we have one
  if (row.team) {
    const teamMatch = candidates.find(
      (c) => (c.team || '').toUpperCase() === row.team.toUpperCase()
    );
    if (teamMatch) return teamMatch;
  }
  return candidates[0];
}

function matchRows(rows, players) {
  const index = buildPlayerIndex(players);
  const matched = [];
  const unmatched = [];
  for (const row of rows) {
    const player = matchRowToPlayer(row, index);
    if (player) {
      matched.push({ ...row, sleeperId: player.id, pos: row.pos || normalizePos(player.position) });
    } else {
      unmatched.push(row);
    }
  }
  return { matched, unmatched };
}

const stores = {};
function storeFor(source) {
  if (!stores[source]) stores[source] = makeStore(`rankings-${source}.json`);
  return stores[source];
}

function saveRankingsForPosition(source, pos, matched, unmatched) {
  // "FLEX" is a combined RB/WR/TE ranking (e.g. Boone's Flex Rankings page) -
  // its rank order is already cross-position comparable, so every matched
  // row stays filed under one FLEX bucket instead of being split back out
  // to each row's own real position (which matchRows backfills for display).
  const exclusive = pos === 'FLEX';
  return storeFor(source).saveForPosition(pos, matched, unmatched, { exclusive });
}

function loadRankings(source) {
  return storeFor(source).load();
}

module.exports = {
  parseRankingsText,
  matchRows,
  saveRankingsForPosition,
  loadRankings,
  normalizeName,
  normalizePos,
  splitCsvLine,
  detectDelimiter,
  findCol,
  detectOneCellPerLine,
};
