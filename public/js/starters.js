// Rankings upload (Boone + JJZ) and the starters-vs-bench comparison/swap table.
(function () {
  function setupUpload(source) {
    const pasteEl = document.getElementById(`${source}-paste`);
    const fileEl = document.getElementById(`${source}-file`);
    const btnEl = document.getElementById(`${source}-upload-btn`);
    const statusEl = document.getElementById(`${source}-status`);

    btnEl.addEventListener('click', async () => {
      statusEl.textContent = 'Uploading...';
      statusEl.className = 'status';
      try {
        let result;
        if (fileEl.files && fileEl.files[0]) {
          result = await Api.postFile(`/api/rankings/${source}`, fileEl.files[0]);
        } else if (pasteEl.value.trim()) {
          result = await Api.post(`/api/rankings/${source}`, { text: pasteEl.value });
        } else {
          statusEl.textContent = 'Paste rankings or choose a file first.';
          statusEl.className = 'status error';
          return;
        }
        statusEl.textContent = `Loaded ${result.matchedCount} players` +
          (result.unmatchedCount ? `, ${result.unmatchedCount} unmatched (see console).` : '.');
        statusEl.className = 'status ok';
        if (result.unmatched && result.unmatched.length) {
          console.warn(`Unmatched ${source} rows:`, result.unmatched);
        }
        if (window.FFHub && window.FFHub.refreshTradeRankingsStatus) {
          window.FFHub.refreshTradeRankingsStatus();
        }
        loadComparison();
      } catch (e) {
        statusEl.textContent = e.message;
        statusEl.className = 'status error';
      }
    });
  }

  function rankCell(rank) {
    return rank ? `#${rank}` : '<span class="hint">unranked</span>';
  }

  async function loadComparison() {
    const league = Store.league;
    const rosterId = Store.rosterId;
    const suggestionsDiv = document.getElementById('suggestions');
    const tableDiv = document.getElementById('starters-table');
    if (!league || !rosterId) {
      suggestionsDiv.innerHTML = '<p class="hint">Load a league and team on the Connect tab first.</p>';
      tableDiv.innerHTML = '';
      return;
    }
    try {
      const data = await Api.get(`/api/starters/${league.league_id}/${rosterId}`);
      if (!data.hasBoone && !data.hasJjz) {
        suggestionsDiv.innerHTML = '<p class="hint">Upload at least one ranking set above to see comparisons.</p>';
      } else if (data.suggestions.length === 0) {
        suggestionsDiv.innerHTML = '<p class="status ok">No swaps suggested - your lineup looks optimal by the loaded rankings.</p>';
      } else {
        suggestionsDiv.innerHTML = data.suggestions
          .map(
            (s) => `<div class="row" style="margin-bottom:6px;">
              <span class="pill warn">${s.slot}</span>
              Bench <strong>${s.suggested.name}</strong> (Boone ${rankCell(s.suggested.boone_rank)}, JJZ ${rankCell(s.suggested.jjz_rank)})
              outranks starter <strong>${s.starter.name}</strong> (Boone ${rankCell(s.starter.boone_rank)}, JJZ ${rankCell(s.starter.jjz_rank)})
              <span class="pill">${s.supportedBy.join(' + ')}</span>
            </div>`
          )
          .join('');
      }

      const rows = [
        ...data.starters.map((p) => ({ ...p, group: 'Starter' })),
        ...data.bench.map((p) => ({ ...p, group: 'Bench' })),
      ];
      tableDiv.innerHTML = `
        <table>
          <thead><tr><th>Slot</th><th>Player</th><th>Pos</th><th>Boone</th><th>JJZ</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (p) => `<tr>
                  <td><span class="pill ${p.group === 'Starter' ? 'starter' : ''}">${p.slot || p.group}</span></td>
                  <td>${p.full_name}</td>
                  <td>${p.position || ''}</td>
                  <td>${rankCell(p.boone_rank)}</td>
                  <td>${rankCell(p.jjz_rank)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>`;
    } catch (e) {
      suggestionsDiv.innerHTML = `<p class="status error">${e.message}</p>`;
      tableDiv.innerHTML = '';
    }
  }

  setupUpload('boone');
  setupUpload('jjz');
  window.FFHub = window.FFHub || {};
  window.FFHub.loadStartersComparison = loadComparison;
})();
