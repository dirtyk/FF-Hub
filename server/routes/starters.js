const express = require('express');
const sleeper = require('../sleeper');
const { loadRankings } = require('../rankings');
const { buildComparison } = require('../starters');

const router = express.Router();

router.get('/:leagueId/:rosterId', async (req, res) => {
  try {
    const full = await sleeper.getFullLeague(req.params.leagueId);
    const team = full.teams.find((t) => String(t.roster_id) === req.params.rosterId);
    if (!team) return res.status(404).json({ error: 'Roster not found in this league.' });

    const rankings = {
      boone: loadRankings('boone'),
      jjz: loadRankings('jjz'),
    };
    const comparison = buildComparison(team, rankings);
    res.json({
      team: { roster_id: team.roster_id, owner_name: team.owner_name },
      hasBoone: !!rankings.boone,
      hasJjz: !!rankings.jjz,
      ...comparison,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = router;
