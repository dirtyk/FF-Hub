const express = require('express');
const multer = require('multer');
const sleeper = require('../sleeper');
const { parseRankingsText, matchRows, saveRankingsForPosition, loadRankings } = require('../rankings');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const VALID_SOURCES = new Set(['boone', 'jjz']);
// FLEX is a combined RB/WR/TE ranking (e.g. Boone's Flex Rankings page) -
// already cross-position comparable, so it's stored/treated as one bucket
// instead of being split back out into RB/WR/TE, see saveRankingsForPosition.
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX']);

function checkSource(req, res, next) {
  if (!VALID_SOURCES.has(req.params.source)) {
    return res.status(400).json({ error: 'source must be "boone" or "jjz"' });
  }
  next();
}

router.get('/:source', checkSource, (req, res) => {
  const data = loadRankings(req.params.source);
  if (!data) return res.status(404).json({ error: 'No rankings uploaded yet for this source.' });
  res.json(data);
});

// Accepts either a raw text body { text: "...", pos: "QB" } (paste) or a
// multipart file upload with a "pos" field. `pos` is the position this
// paste/file is for (Boone publishes one list per position) - rows that
// already carry their own Position column override it. Uploading a position
// again replaces only that position's slice.
router.post('/:source', checkSource, upload.single('file'), async (req, res) => {
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : req.body.text;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No file or pasted text provided.' });
    }
    const pos = (req.body.pos || '').toUpperCase().trim();
    if (pos && !VALID_POSITIONS.has(pos)) {
      return res.status(400).json({ error: `pos must be one of ${[...VALID_POSITIONS].join(', ')}` });
    }
    const { rows, warnings } = parseRankingsText(text, pos);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Could not parse any rows.', warnings });
    }
    const players = await sleeper.getAllPlayers();
    const { matched, unmatched } = matchRows(rows, players);
    const saved = saveRankingsForPosition(req.params.source, pos, matched, unmatched);
    res.json({
      ...saved,
      warnings,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
