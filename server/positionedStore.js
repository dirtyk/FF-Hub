// Generic on-disk storage for any dataset that's uploaded one position at a
// time (Boone/JJZ publish separate QB/RB/WR/TE/K/DEF pages, for both
// rankings and trade-value charts). A file holds {positions: {QB: {...}}};
// uploading a position replaces only that position's slice.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function makeStore(fileName) {
  const filePath = path.join(DATA_DIR, fileName);

  function readRaw() {
    if (!fs.existsSync(filePath)) return { positions: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed.positions) return parsed;
      // Migrate the old flat {uploadedAt, rows, unmatched} shape from before
      // datasets were split per-position, if anyone still has one on disk.
      if (parsed.rows) {
        const positions = {};
        for (const row of parsed.rows) {
          const pos = row.pos || 'UNKNOWN';
          (positions[pos] = positions[pos] || { uploadedAt: parsed.uploadedAt, rows: [], unmatched: [] }).rows.push(row);
        }
        return { positions };
      }
      return { positions: {} };
    } catch {
      return { positions: {} };
    }
  }

  function flatten(file) {
    const rows = [];
    const unmatched = [];
    let uploadedAt = 0;
    for (const slice of Object.values(file.positions)) {
      rows.push(...slice.rows);
      unmatched.push(...(slice.unmatched || []));
      uploadedAt = Math.max(uploadedAt, slice.uploadedAt || 0);
    }
    return { uploadedAt, rows, unmatched, positions: file.positions };
  }

  // If the pasted/uploaded rows happen to carry their own mixed positions
  // (e.g. a combined export with a Position column), each row is filed under
  // its own position rather than the slice `pos` the caller picked.
  function saveForPosition(pos, matched, unmatched) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = readRaw();
    const uploadedAt = Date.now();

    const touched = new Set();
    const byPos = {};
    for (const row of matched) {
      const rowPos = row.pos || pos || 'UNKNOWN';
      (byPos[rowPos] = byPos[rowPos] || []).push(row);
      touched.add(rowPos);
    }
    // A position slice with zero matched rows this upload still counts as
    // "touched" so it gets replaced/cleared rather than keeping stale data
    // under the position the user picked.
    touched.add(pos || 'UNKNOWN');

    for (const p of touched) {
      file.positions[p] = { uploadedAt, rows: byPos[p] || [], unmatched: p === (pos || 'UNKNOWN') ? unmatched : [] };
    }

    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf8');
    return flatten(file);
  }

  function load() {
    const file = readRaw();
    if (Object.keys(file.positions).length === 0) return null;
    return flatten(file);
  }

  return { saveForPosition, load };
}

module.exports = { makeStore };
