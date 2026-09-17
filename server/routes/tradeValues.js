const express = require('express');
const multer = require('multer');
const sleeper = require('../sleeper');
const { matchRows } = require('../rankings');
const { parseTradeValueText, saveTradeValuesForPosition, loadTradeValues } = require('../tradeValues');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

// Only Boone publishes a trade value chart (JJZ's rankings are used for the
// Starters tool only) - kept as a route param for symmetry/future sources.
router.get('/:source', (req, res) => {
  if (req.params.source !== 'boone') return res.status(404).json({ error: 'Unknown source.' });
  const data = loadTradeValues();
  if (!data) return res.status(404).json({ error: 'No Boone trade values uploaded yet.' });
  res.json(data);
});

router.post('/:source', upload.single('file'), async (req, res) => {
  if (req.params.source !== 'boone') return res.status(404).json({ error: 'Unknown source.' });
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : req.body.text;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No file or pasted text provided.' });
    }
    const pos = (req.body.pos || '').toUpperCase().trim();
    if (pos && !VALID_POSITIONS.has(pos)) {
      return res.status(400).json({ error: `pos must be one of ${[...VALID_POSITIONS].join(', ')}` });
    }
    const { rows, warnings } = parseTradeValueText(text, pos);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Could not parse any rows.', warnings });
    }
    const players = await sleeper.getAllPlayers();
    const { matched, unmatched } = matchRows(rows, players);
    const saved = saveTradeValuesForPosition(pos, matched, unmatched);
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
