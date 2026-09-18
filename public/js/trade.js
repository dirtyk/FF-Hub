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
      .map((p) => {
        const base = `${p.position || ''} ${p.team || ''}`.trim();
        return `<li data-id="${p.player_id}">
          <span>${p.full_name} <span class="meta" data-base="${base}">${base}</span></span>
          <button class="remove-btn" data-id="${p.player_id}">&times;</button>
        </li>`;
      })
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

  // Always rebuilds from the base text (position/team) stored on the
  // element rather than appending, so re-running evaluate() - which
  // annotates both sides every time, not just the one that changed - never
  // stacks duplicate " · value N" text onto a side that wasn't touched.
  function annotateValues(sideKey, scored) {
    const listEl = document.getElementById(`list-${sideKey}`);
    scored.forEach((p) => {
      const li = listEl.querySelector(`li[data-id="${p.sleeperId}"]`);
      if (!li) return;
      const meta = li.querySelector('.meta');
      const valueTxt = p.value ? `value ${p.value}` : 'no trade value loaded';
      meta.innerHTML = `${meta.dataset.base} &middot; ${valueTxt}`;
    });
  }

  function renderLoadedPositions(el, positions) {
    if (!positions) return;
    const summary = Object.entries(positions)
      .filter(([, slice]) => slice.rows.length > 0)
      .map(([pos, slice]) => `${pos} (${slice.rows.length})`)
      .join(', ');
    el.textContent = summary ? `Loaded: ${summary}` : '';
  }

  function setupTradeValueUpload() {
    const posEl = document.getElementById('boonetv-pos');
    const urlEl = document.getElementById('boonetv-url');
    const scrapeBtnEl = document.getElementById('boonetv-scrape-btn');
    const scrapeStatusEl = document.getElementById('boonetv-scrape-status');
    const pasteEl = document.getElementById('boonetv-paste');
    const fileEl = document.getElementById('boonetv-file');
    const btnEl = document.getElementById('boonetv-upload-btn');
    const statusEl = document.getElementById('boonetv-status');
    const loadedEl = document.getElementById('boonetv-loaded');

    function onLoaded(pos, result, statusEl) {
      statusEl.textContent = `${pos}: loaded ${result.matchedCount} players` +
        (result.unmatchedCount ? `, ${result.unmatchedCount} unmatched (see console).` : '.');
      statusEl.className = 'status ok';
      if (result.unmatched && result.unmatched.length) {
        console.warn(`Unmatched Boone trade-value ${pos} rows:`, result.unmatched);
      }
      renderLoadedPositions(loadedEl, result.positions);
      evaluate();
    }

    scrapeBtnEl.addEventListener('click', async () => {
      const url = urlEl.value.trim();
      if (!url) {
        scrapeStatusEl.textContent = 'Paste the article URL first.';
        scrapeStatusEl.className = 'status error';
        return;
      }
      scrapeStatusEl.textContent = 'Fetching...';
      scrapeStatusEl.className = 'status';
      const pos = posEl.value;
      try {
        const result = await Api.post('/api/tradevalues/boone/scrape', { url, pos });
        onLoaded(pos, result, scrapeStatusEl);
      } catch (e) {
        scrapeStatusEl.textContent = e.message;
        scrapeStatusEl.className = 'status error';
      }
    });

    btnEl.addEventListener('click', async () => {
      statusEl.textContent = 'Uploading...';
      statusEl.className = 'status';
      const pos = posEl.value;
      try {
        let result;
        if (fileEl.files && fileEl.files[0]) {
          result = await Api.postFile('/api/tradevalues/boone', fileEl.files[0], { pos });
        } else if (pasteEl.value.trim()) {
          result = await Api.post('/api/tradevalues/boone', { text: pasteEl.value, pos });
        } else {
          statusEl.textContent = 'Paste the chart or choose a file first.';
          statusEl.className = 'status error';
          return;
        }
        onLoaded(pos, result, statusEl);
      } catch (e) {
        statusEl.textContent = e.message;
        statusEl.className = 'status error';
      }
    });

    Api.get('/api/tradevalues/boone')
      .then((data) => renderLoadedPositions(loadedEl, data.positions))
      .catch(() => {});
  }

  setupSide('giving');
  setupSide('receiving');
  setupTradeValueUpload();
})();
