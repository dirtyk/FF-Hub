// Thin client over the public Sleeper API (https://docs.sleeper.com/), with an
// on-disk cache for the large players blob (Sleeper asks that it not be fetched
// more than once per day).
const fs = require('fs');
const path = require('path');

const BASE = 'https://api.sleeper.app/v1';
const DATA_DIR = path.join(__dirname, '..', 'data');
const PLAYERS_CACHE_PATH = path.join(DATA_DIR, 'players-cache.json');
const PLAYERS_CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1000; // 20h, Sleeper asks for <= 1x/day

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function sleeperGet(pathSuffix) {
  const res = await fetch(`${BASE}${pathSuffix}`);
  if (!res.ok) {
    const err = new Error(`Sleeper API ${pathSuffix} -> ${res.status}`);
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }
  return res.json();
}

function currentSeason() {
  // NFL season year: Sleeper's "season" for leagues rolls over well before
  // the calendar year does (new league year is set up by ~March). Using the
  // current calendar year is correct from March onward, which covers draft
  // season through the following January/February when last year's leagues
  // are typically archived anyway.
  return String(new Date().getFullYear());
}

async function getUserByUsername(username) {
  return sleeperGet(`/user/${encodeURIComponent(username)}`);
}

async function getLeaguesForUser(userId, season) {
  return sleeperGet(`/user/${encodeURIComponent(userId)}/leagues/nfl/${season || currentSeason()}`);
}

async function getLeague(leagueId) {
  return sleeperGet(`/league/${encodeURIComponent(leagueId)}`);
}

async function getRosters(leagueId) {
  return sleeperGet(`/league/${encodeURIComponent(leagueId)}/rosters`);
}

async function getLeagueUsers(leagueId) {
  return sleeperGet(`/league/${encodeURIComponent(leagueId)}/users`);
}

async function getAllPlayers({ forceRefresh = false } = {}) {
  ensureDataDir();
  if (!forceRefresh && fs.existsSync(PLAYERS_CACHE_PATH)) {
    try {
      const cached = JSON.parse(fs.readFileSync(PLAYERS_CACHE_PATH, 'utf8'));
      if (Date.now() - cached.fetchedAt < PLAYERS_CACHE_MAX_AGE_MS) {
        return cached.players;
      }
    } catch {
      // fall through to refetch on any read/parse error
    }
  }
  const players = await sleeperGet('/players/nfl');
  fs.writeFileSync(
    PLAYERS_CACHE_PATH,
    JSON.stringify({ fetchedAt: Date.now(), players }),
    'utf8'
  );
  return players;
}

// Combines league + rosters + users into one payload the frontend can use
// directly for both the Trade Calculator and Starters tool.
async function getFullLeague(leagueId) {
  const [league, rosters, users, players] = await Promise.all([
    getLeague(leagueId),
    getRosters(leagueId),
    getLeagueUsers(leagueId),
    getAllPlayers(),
  ]);

  const userById = new Map(users.map((u) => [u.user_id, u]));

  // Sleeper's roster.starters array is positionally aligned with
  // roster_positions once BN/IR/TAXI slots are filtered out.
  const startingSlots = (league.roster_positions || []).filter(
    (p) => !['BN', 'IR', 'TAXI'].includes(p)
  );

  const teams = rosters.map((r) => {
    const owner = userById.get(r.owner_id);
    const starterIds = r.starters || [];
    const allIds = r.players || [];
    const benchIds = allIds.filter((id) => !starterIds.includes(id));
    const hydrate = (id) => {
      const p = players[id];
      if (!p) return { player_id: id, full_name: id, position: null, team: null };
      return {
        player_id: id,
        full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        position: p.position,
        team: p.team,
      };
    };
    return {
      roster_id: r.roster_id,
      owner_id: r.owner_id,
      owner_name: owner ? (owner.metadata?.team_name || owner.display_name) : 'Unknown',
      starters: starterIds
        .filter((id) => id && id !== '0')
        .map((id, i) => ({ ...hydrate(id), slot: startingSlots[i] || null })),
      bench: benchIds.filter((id) => id && id !== '0').map(hydrate),
    };
  });

  return {
    league_id: league.league_id,
    name: league.name,
    season: league.season,
    roster_positions: league.roster_positions,
    teams,
  };
}

module.exports = {
  getUserByUsername,
  getLeaguesForUser,
  getLeague,
  getRosters,
  getLeagueUsers,
  getAllPlayers,
  getFullLeague,
  currentSeason,
};
