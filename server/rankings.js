// Parses an uploaded/pasted rankings file (CSV-ish: Rank, Player, Team, Position
// in some header order) and matches each row to a Sleeper player_id, so the
// Trade Calculator and Starters tool can join rankings onto real rosters.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const SUFFIXES = /\b(jr|sr|ii|iii|iv|v)\.?$/i;
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

// Parses raw pasted/uploaded text into rows: [{rank, name, pos, team}]
function parseRankingsText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], warnings: ['Empty input.'] };

  const delim = detectDelimiter(lines[0]);
  const splitLine = (l) => (delim === '\t' ? l.split('\t').map((s) => s.trim()) : splitCsvLine(l));

  const firstCells = splitLine(lines[0]);
  const looksLikeHeader = firstCells.some((c) =>
    /^(rank|player|name|team|pos|position|overall)/i.test(c)
  );

  let headers;
  let dataLines;
  if (looksLikeHeader) {
    headers = firstCells;
    dataLines = lines.slice(1);
  } else {
    // No header - assume "rank, player, team, pos" if 4 cols, else fall back
    headers = ['rank', 'player', 'team', 'pos'].slice(0, firstCells.length);
    dataLines = lines;
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
    rows.push({
      rank: Number.isFinite(rank) ? rank : i + 1,
      name: name.trim(),
      team: teamCol !== -1 ? (cells[teamCol] || '').trim() : '',
      pos: posCol !== -1 ? normalizePos(cells[posCol]) : '',
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

function rankingsPath(source) {
  return path.join(DATA_DIR, `rankings-${source}.json`);
}

function saveRankings(source, matched, unmatched) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = { uploadedAt: Date.now(), rows: matched, unmatched };
  fs.writeFileSync(rankingsPath(source), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function loadRankings(source) {
  const p = rankingsPath(source);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  parseRankingsText,
  matchRows,
  saveRankings,
  loadRankings,
  normalizeName,
  normalizePos,
};
