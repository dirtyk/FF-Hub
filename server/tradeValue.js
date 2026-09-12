// Converts an overall rank into a trade "value" via a diminishing-returns
// curve (rank 1 ~1000, rank 10 ~251, rank 50 ~87, rank 150 ~40, ...).
// The exponent is the one knob to tune if values ever feel off.
const CURVE_EXPONENT = 0.6;
const CURVE_SCALE = 1000;

function valueForRank(rank) {
  if (!rank || rank <= 0) return 0;
  return Math.round(CURVE_SCALE / Math.pow(rank, CURVE_EXPONENT));
}

// sideA / sideB: arrays of { sleeperId, full_name, position, rank } (rank may
// be null/undefined for unranked/unmatched players).
function evaluateTrade(sideA, sideB) {
  const scoreSide = (side) =>
    side.map((p) => ({
      ...p,
      value: p.rank ? valueForRank(p.rank) : 0,
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

module.exports = { valueForRank, evaluateTrade };
