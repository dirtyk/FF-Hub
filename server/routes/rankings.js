const express = require('express');
const multer = require('multer');
const sleeper = require('../sleeper');
const { parseRankingsText, matchRows, saveRankings, loadRankings } = require('../rankings');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const VALID_SOURCES = new Set(['boone', 'jjz']);

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

// Accepts either a raw text body { text: "..." } (paste) or a multipart file upload.
router.post('/:source', checkSource, upload.single('file'), async (req, res) => {
  try {
    const text = req.file ? req.file.buffer.toString('utf8') : req.body.text;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'No file or pasted text provided.' });
    }
    const { rows, warnings } = parseRankingsText(text);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Could not parse any rows.', warnings });
    }
    const players = await sleeper.getAllPlayers();
    const { matched, unmatched } = matchRows(rows, players);
    const saved = saveRankings(req.params.source, matched, unmatched);
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
