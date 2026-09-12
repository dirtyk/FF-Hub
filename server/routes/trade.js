const express = require('express');
const { loadRankings } = require('../rankings');
const { evaluateTrade } = require('../tradeValue');

const router = express.Router();

// Body: { sideA: [{sleeperId, full_name, position}], sideB: [...] }
// Values come from the Boone ranking set (the calculator's designated source).
router.post('/evaluate', (req, res) => {
  const { sideA, sideB } = req.body || {};
  if (!Array.isArray(sideA) || !Array.isArray(sideB)) {
    return res.status(400).json({ error: 'sideA and sideB arrays are required.' });
  }
  const boone = loadRankings('boone');
  if (!boone) {
    return res.status(400).json({ error: 'Upload Boone rankings first (Starters tab) before evaluating trades.' });
  }
  const rankById = new Map(boone.rows.map((r) => [r.sleeperId, r.rank]));
  const withRank = (side) =>
    side.map((p) => ({ ...p, rank: rankById.get(p.sleeperId) ?? null }));

  const result = evaluateTrade(withRank(sideA), withRank(sideB));
  res.json(result);
});

module.exports = router;
