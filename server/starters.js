// Compares a team's actual starting lineup against its bench using one or
// more ranking sources, and suggests swaps where a bench player outranks the
// starter occupying a slot he's eligible for.
const { valueForPlayer } = require('./tradeValue');

const SLOT_ELIGIBILITY = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  K: ['K'],
  DEF: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
};

function eligiblePositions(slot) {
  return SLOT_ELIGIBILITY[slot] || (slot ? [slot] : []);
}

// rankingSources: { boone: {bySleeperId: Map}, jjz: {bySleeperId: Map} }
function rankIndex(rankingPayload) {
  const map = new Map();
  if (!rankingPayload) return map;
  for (const row of rankingPayload.rows) {
    map.set(row.sleeperId, row.rank);
  }
  return map;
}

function buildComparison(team, rankings) {
  const booneIdx = rankIndex(rankings.boone);
  const jjzIdx = rankIndex(rankings.jjz);

  const withRanks = (p) => ({
    ...p,
    boone_rank: booneIdx.get(p.player_id) ?? null,
    jjz_rank: jjzIdx.get(p.player_id) ?? null,
  });

  const starters = team.starters.map(withRanks);
  const bench = team.bench.map(withRanks);

  // Comparisons use position-weighted *value*, not raw rank: a same-position
  // slot (QB vs QB, RB vs RB) ranks identically either way, but FLEX/SUPERFLEX
  // slots pit different positions against each other (e.g. bench RB vs
  // starting TE) where raw positional ranks (rank 5 within each position)
  // aren't directly comparable.
  const valueOf = (p, source) => {
    const rank = p[source];
    return rank ? valueForPlayer(p.position, rank) : null;
  };

  const suggestions = [];
  for (const starter of starters) {
    const eligible = eligiblePositions(starter.slot);
    if (eligible.length === 0) continue;
    const candidates = bench.filter((b) => eligible.includes(b.position));
    // best bench candidate per source, then merged by player so a bench
    // player who outranks the starter on both sources shows as one row.
    const bestBySource = {};
    for (const source of ['boone_rank', 'jjz_rank']) {
      const starterValue = valueOf(starter, source);
      let best = null;
      let bestValue = 0;
      for (const c of candidates) {
        const cValue = valueOf(c, source);
        if (cValue == null) continue;
        if (starterValue == null || cValue > starterValue) {
          if (cValue > bestValue) {
            best = c;
            bestValue = cValue;
          }
        }
      }
      if (best) bestBySource[source] = best;
    }
    const byPlayer = new Map();
    for (const [source, bench_player] of Object.entries(bestBySource)) {
      const key = bench_player.player_id;
      if (!byPlayer.has(key)) {
        byPlayer.set(key, {
          slot: starter.slot,
          starter: { name: starter.full_name, position: starter.position, boone_rank: starter.boone_rank, jjz_rank: starter.jjz_rank },
          suggested: { name: bench_player.full_name, position: bench_player.position, boone_rank: bench_player.boone_rank, jjz_rank: bench_player.jjz_rank },
          supportedBy: [],
        });
      }
      byPlayer.get(key).supportedBy.push(source === 'boone_rank' ? 'Boone' : 'JJZ');
    }
    suggestions.push(...byPlayer.values());
  }

  return { starters, bench, suggestions };
}

module.exports = { buildComparison, eligiblePositions };
