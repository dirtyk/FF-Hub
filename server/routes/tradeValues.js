const express = require('express');
const multer = require('multer');
const sleeper = require('../sleeper');
const { matchRows } = require('../rankings');
const { parseTradeValueText, saveTradeValuesForPosition, loadTradeValues } = require('../tradeValues');
const { fetchTableAsTsv } = require('../scrape');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

function checkPos(pos, res) {
  if (pos && !VALID_POSITIONS.has(pos)) {
    res.status(400).json({ error: `pos must be one of ${[...VALID_POSITIONS].join(', ')}` });
    return false;
  }
  return true;
}

async function parseMatchAndSave(text, pos, res) {
  const { rows, warnings } = parseTradeValueText(text, pos);
  if (rows.length === 0) {
    res.status(400).json({ error: 'Could not parse any rows.', warnings });
    return;
  }
  const players = await sleeper.getAllPlayers();
  const { matched, unmatched } = matchRows(rows, players);
  const saved = saveTradeValuesForPosition(pos, matched, unmatched);
  res.json({ ...saved, warnings, matchedCount: matched.length, unmatchedCount: unmatched.length });
}

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
    if (!checkPos(pos, res)) return;
    await parseMatchAndSave(text, pos, res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetches a Trade Value Chart page directly (verified against Boone's
// pages: they're server-rendered with a real HTML table, unlike his prose
// rankings pages) instead of requiring a manual copy/paste.
router.post('/:source/scrape', async (req, res) => {
  if (req.params.source !== 'boone') return res.status(404).json({ error: 'Unknown source.' });
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required.' });
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'That is not a valid URL.' });
    }
    if (!/(^|\.)yahoo\.com$/i.test(parsed.hostname)) {
      return res.status(400).json({ error: 'Only sports.yahoo.com URLs are supported.' });
    }
    const pos = (req.body.pos || '').toUpperCase().trim();
    if (!checkPos(pos, res)) return;
    const text = await fetchTableAsTsv(url);
    await parseMatchAndSave(text, pos, res);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
