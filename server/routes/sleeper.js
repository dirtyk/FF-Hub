const express = require('express');
const sleeper = require('../sleeper');

const router = express.Router();

router.get('/user/:username', async (req, res) => {
  try {
    const user = await sleeper.getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'Sleeper username not found.' });
    res.json(user);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/leagues/:userId', async (req, res) => {
  try {
    const season = req.query.season;
    const leagues = await sleeper.getLeaguesForUser(req.params.userId, season);
    res.json(leagues);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/league/:leagueId/full', async (req, res) => {
  try {
    const full = await sleeper.getFullLeague(req.params.leagueId);
    res.json(full);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = router;
