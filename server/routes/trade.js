const express = require('express');
const { loadTradeValues } = require('../tradeValues');
const { combineSides } = require('../tradeValue');

const router = express.Router();

// Body: { sideA: [{sleeperId, full_name}], sideB: [...] }
// Values come straight from Boone's uploaded Trade Value Chart (HALF/0.5 PPR
// column) - his numbers are already meant to compare across positions, so
// no extra curve/weighting is applied here.
router.post('/evaluate', (req, res) => {
  const { sideA, sideB } = req.body || {};
  if (!Array.isArray(sideA) || !Array.isArray(sideB)) {
    return res.status(400).json({ error: 'sideA and sideB arrays are required.' });
  }
  const values = loadTradeValues();
  if (!values) {
    return res.status(400).json({ error: 'Upload Boone\'s Trade Value Chart first (Trade Calculator tab) before evaluating trades.' });
  }
  const byId = new Map(values.rows.map((r) => [r.sleeperId, r]));
  const scoreSide = (side) =>
    side.map((p) => {
      const v = byId.get(p.sleeperId);
      return {
        ...p,
        position: v ? v.pos : p.position,
        value: v ? Math.round(v.half) : 0,
      };
    });

  const result = combineSides(scoreSide(sideA), scoreSide(sideB));
  res.json(result);
});

module.exports = router;
