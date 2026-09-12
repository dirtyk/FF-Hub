// Trade Calculator: autocomplete search over the loaded league's rostered
// players, two sides (Giving/Receiving), evaluated against Boone's rankings.
(function () {
  const sides = { giving: [], receiving: [] };

  function allLeaguePlayers() {
    const league = Store.league;
    if (!league) return [];
    const out = [];
    for (const team of league.teams) {
      for (const p of [...team.starters, ...team.bench]) {
        out.push({ ...p, owner_name: team.owner_name });
      }
    }
    return out;
  }

  function setupSide(sideKey) {
    const searchInput = document.getElementById(`search-${sideKey}`);
    const autocompleteDiv = document.getElementById(`autocomplete-${sideKey}`);
    const listEl = document.getElementById(`list-${sideKey}`);

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (q.length < 2) {
        autocompleteDiv.hidden = true;
        autocompleteDiv.innerHTML = '';
        return;
      }
      const matches = allLeaguePlayers()
        .filter((p) => p.full_name.toLowerCase().includes(q))
        .slice(0, 8);
      if (matches.length === 0) {
        autocompleteDiv.hidden = true;
        return;
      }
      autocompleteDiv.innerHTML = matches
        .map(
          (p, i) => `<div class="autocomplete-item" data-idx="${i}">
            ${p.full_name}
            <div class="meta">${p.position || ''} ${p.team || ''} &middot; ${p.owner_name}</div>
          </div>`
        )
        .join('');
      autocompleteDiv.hidden = false;
      autocompleteDiv.querySelectorAll('.autocomplete-item').forEach((el, i) => {
        el.addEventListener('click', () => {
          addPlayer(sideKey, matches[i]);
          searchInput.value = '';
          autocompleteDiv.hidden = true;
        });
      });
    });

    document.addEventListener('click', (e) => {
      if (!autocompleteDiv.contains(e.target) && e.target !== searchInput) {
        autocompleteDiv.hidden = true;
      }
    });
  }

  function addPlayer(sideKey, player) {
    if (sides[sideKey].some((p) => p.player_id === player.player_id)) return;
    sides[sideKey].push(player);
    renderList(sideKey);
    evaluate();
  }

  function removePlayer(sideKey, playerId) {
    sides[sideKey] = sides[sideKey].filter((p) => p.player_id !== playerId);
    renderList(sideKey);
    evaluate();
  }

  function renderList(sideKey) {
    const listEl = document.getElementById(`list-${sideKey}`);
    listEl.innerHTML = sides[sideKey]
      .map(
        (p) => `<li data-id="${p.player_id}">
          <span>${p.full_name} <span class="meta">${p.position || ''} ${p.team || ''}</span></span>
          <button class="remove-btn" data-id="${p.player_id}">&times;</button>
        </li>`
      )
      .join('');
    listEl.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', () => removePlayer(sideKey, btn.dataset.id));
    });
  }

  async function evaluate() {
    const verdictEl = document.getElementById('trade-verdict');
    if (sides.giving.length === 0 || sides.receiving.length === 0) {
      verdictEl.textContent = 'Add players to both sides.';
      document.getElementById('total-giving').textContent = '0';
      document.getElementById('total-receiving').textContent = '0';
      return;
    }
    try {
      const result = await Api.post('/api/trade/evaluate', {
        sideA: sides.giving.map((p) => ({ sleeperId: p.player_id, full_name: p.full_name })),
        sideB: sides.receiving.map((p) => ({ sleeperId: p.player_id, full_name: p.full_name })),
      });
      document.getElementById('total-giving').textContent = result.totalA;
      document.getElementById('total-receiving').textContent = result.totalB;
      verdictEl.textContent = result.verdict;
      annotateValues('giving', result.sideA);
      annotateValues('receiving', result.sideB);
    } catch (e) {
      verdictEl.textContent = e.message;
    }
  }

  function annotateValues(sideKey, scored) {
    const listEl = document.getElementById(`list-${sideKey}`);
    scored.forEach((p) => {
      const li = listEl.querySelector(`li[data-id="${p.sleeperId}"]`);
      if (!li) return;
      const meta = li.querySelector('.meta');
      const rankTxt = p.rank ? `#${p.rank} &middot; value ${p.value}` : 'unranked';
      meta.innerHTML += ` &middot; ${rankTxt}`;
    });
  }

  function refreshRankingsStatus() {
    const el = document.getElementById('trade-rankings-status');
    Api.get('/api/rankings/boone')
      .then((data) => {
        el.textContent = `Boone rankings loaded (${data.rows.length} players, uploaded ${new Date(data.uploadedAt).toLocaleString()}).`;
        el.className = 'status ok';
      })
      .catch(() => {
        el.textContent = 'No Boone rankings uploaded yet - go to the Starters tab to upload them.';
        el.className = 'status error';
      });
  }

  setupSide('giving');
  setupSide('receiving');
  window.FFHub = window.FFHub || {};
  window.FFHub.refreshTradeRankingsStatus = refreshRankingsStatus;
  refreshRankingsStatus();
})();
