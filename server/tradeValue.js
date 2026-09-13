// Converts a player's (position, positional rank) into a trade "value" via a
// diminishing-returns rank curve plus a positional weight - needed because
// Boone's rankings are published per-position (his "RB #5" and "TE #5" are
// not worth the same), so ranks alone aren't comparable across positions.
const CURVE_EXPONENT = 0.6;
const CURVE_SCALE = 1000;

// Rough single-QB, 0.5 PPR redraft weighting: RB/WR carry the most trade
// value, top-of-market TE is close behind, QB is worth notably less than
// RB/WR in a single-QB league (bump toward 1.0 for superflex/2QB leagues),
// and K/DEF are essentially worthless in trades. Tune freely.
const POSITION_WEIGHTS = {
  RB: 1.0,
  WR: 1.0,
  TE: 0.85,
  QB: 0.55,
  K: 0.05,
  DEF: 0.05,
};

function weightForPosition(pos) {
  return POSITION_WEIGHTS[pos] ?? 0.7; // unknown position: middling default
}

function valueForRank(rank) {
  if (!rank || rank <= 0) return 0;
  return Math.round(CURVE_SCALE / Math.pow(rank, CURVE_EXPONENT));
}

function valueForPlayer(position, rank) {
  if (!rank || rank <= 0) return 0;
  return Math.round(valueForRank(rank) * weightForPosition(position));
}

// sideA / sideB: arrays of { sleeperId, full_name, position, rank } (rank may
// be null/undefined for unranked/unmatched players).
function evaluateTrade(sideA, sideB) {
  const scoreSide = (side) =>
    side.map((p) => ({
      ...p,
      value: valueForPlayer(p.position, p.rank),
    }));

  const scoredA = scoreSide(sideA);
  const scoredB = scoreSide(sideB);
  const totalA = scoredA.reduce((s, p) => s + p.value, 0);
  const totalB = scoredB.reduce((s, p) => s + p.value, 0);
  const diff = totalA - totalB;
  const bigger = Math.max(totalA, totalB) || 1;
  const pctDiff = Math.abs(diff) / bigger;

  let verdict;
  if (pctDiff <= 0.05) {
    verdict = 'Roughly even trade';
  } else if (diff > 0) {
    verdict = `Side A is giving up more value (+${Math.abs(diff)})`;
  } else {
    verdict = `Side B is giving up more value (+${Math.abs(diff)})`;
  }

  return {
    sideA: scoredA,
    sideB: scoredB,
    totalA,
    totalB,
    diff,
    pctDiff,
    verdict,
  };
}

module.exports = { valueForRank, valueForPlayer, evaluateTrade };
