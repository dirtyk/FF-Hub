// Parses Boone's "Trade Value Chart" pages - a different Yahoo product from
// his rankings pages: one table per position with a Player column plus HALF
// (0.5 PPR) and PPR value columns, where the numbers are already meant to be
// compared across positions (his own methodology bakes in positional
// scarcity), unlike his rankings which are only ordered within a position.
// This is what the Trade Calculator uses; the rankings module + Boone's rank
// pages are what the Starters tool uses.
const { makeStore } = require('./positionedStore');
const { splitCsvLine, detectDelimiter, findCol, normalizePos } = require('./rankings');

// Parses raw pasted/uploaded text into rows: [{name, team, pos, half, ppr}].
// fallbackPos is applied when the pasted table has no Position column of its
// own (Boone's per-position pages don't) - same one-position-at-a-time flow
// as the rankings uploads.
function parseTradeValueText(text, fallbackPos) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], warnings: ['Empty input.'] };

  const delim = detectDelimiter(lines[0]);
  const splitLine = (l) => (delim === '\t' ? l.split('\t').map((s) => s.trim()) : splitCsvLine(l));

  const firstCells = splitLine(lines[0]);
  const looksLikeHeader = firstCells.some((c) =>
    /^(player|name|team|pos|position|half|ppr|value)/i.test(c)
  );

  let headers;
  let dataLines;
  if (looksLikeHeader) {
    headers = firstCells;
    dataLines = lines.slice(1);
  } else {
    // No header: Boone's chart is Player, HALF, PPR in that order.
    const n = firstCells.length;
    headers = n === 2 ? ['player', 'half'] : n === 3 ? ['player', 'half', 'ppr'] : ['player', 'team', 'half', 'ppr'];
    dataLines = lines;
  }

  const nameCol = findCol(headers, ['player', 'playername', 'name']);
  const teamCol = findCol(headers, ['team', 'nflteam', 'tm']);
  const posCol = findCol(headers, ['pos', 'position']);
  let halfCol = findCol(headers, ['half', '05ppr', 'halfppr', 'halfpprvalue', 'halfvalue']);
  const pprCol = findCol(headers, ['ppr', 'fullppr', 'pprvalue', 'full']);
  if (halfCol === -1) halfCol = findCol(headers, ['value', 'tradevalue']);

  const warnings = [];
  if (nameCol === -1) {
    warnings.push('Could not find a Player/Name column - check the file format.');
    return { rows: [], warnings };
  }
  if (halfCol === -1 && pprCol === -1) {
    warnings.push('Could not find a HALF or PPR value column - check the file format.');
    return { rows: [], warnings };
  }
  if (halfCol === -1) {
    warnings.push('No HALF (0.5 PPR) column found - using the PPR column instead.');
  }

  const rows = [];
  dataLines.forEach((line) => {
    const cells = splitLine(line);
    const name = cells[nameCol];
    if (!name) return;
    const half = halfCol !== -1 ? parseFloat(cells[halfCol]) : parseFloat(cells[pprCol]);
    if (!Number.isFinite(half)) return; // no usable value for this row - skip it
    const ppr = pprCol !== -1 ? parseFloat(cells[pprCol]) : null;
    rows.push({
      name: name.trim(),
      team: teamCol !== -1 ? (cells[teamCol] || '').trim() : '',
      pos: (posCol !== -1 ? normalizePos(cells[posCol]) : '') || normalizePos(fallbackPos) || '',
      half,
      ppr: Number.isFinite(ppr) ? ppr : null,
    });
  });

  rows.sort((a, b) => b.half - a.half);
  return { rows, warnings };
}

const store = makeStore('tradevalues-boone.json');

function saveTradeValuesForPosition(pos, matched, unmatched) {
  return store.saveForPosition(pos, matched, unmatched);
}

function loadTradeValues() {
  return store.load();
}

module.exports = { parseTradeValueText, saveTradeValuesForPosition, loadTradeValues };
