// Rankings upload (Boone + JJZ) and the starters-vs-bench comparison/swap table.
(function () {
  function setupUpload(source) {
    const posEl = document.getElementById(`${source}-pos`);
    const pasteEl = document.getElementById(`${source}-paste`);
    const fileEl = document.getElementById(`${source}-file`);
    const btnEl = document.getElementById(`${source}-upload-btn`);
    const statusEl = document.getElementById(`${source}-status`);
    const loadedEl = document.getElementById(`${source}-loaded`);

    btnEl.addEventListener('click', async () => {
      statusEl.textContent = 'Uploading...';
      statusEl.className = 'status';
      const pos = posEl.value;
      try {
        let result;
        if (fileEl.files && fileEl.files[0]) {
          result = await Api.postFile(`/api/rankings/${source}`, fileEl.files[0], { pos });
        } else if (pasteEl.value.trim()) {
          result = await Api.post(`/api/rankings/${source}`, { text: pasteEl.value, pos });
        } else {
          statusEl.textContent = 'Paste rankings or choose a file first.';
          statusEl.className = 'status error';
          return;
        }
        statusEl.textContent = `${pos}: loaded ${result.matchedCount} players` +
          (result.unmatchedCount ? `, ${result.unmatchedCount} unmatched (see console).` : '.');
        statusEl.className = 'status ok';
        if (result.unmatched && result.unmatched.length) {
          console.warn(`Unmatched ${source} ${pos} rows:`, result.unmatched);
        }
        renderLoadedPositions(source, loadedEl, result.positions);
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

  function renderLoadedPositions(source, el, positions) {
    if (!positions) return;
    const summary = Object.entries(positions)
      .filter(([, slice]) => slice.rows.length > 0)
      .map(([pos, slice]) => `${pos} (${slice.rows.length})`)
      .join(', ');
    el.textContent = summary ? `Loaded: ${summary}` : '';
  }

  // Ranks are per-position (Boone/JJZ each publish separate position lists),
  // so "#5" only makes sense alongside its position - pass withPos:true where
  // there isn't already an adjacent Position column making that clear.
  function rankCell(pos, rank, withPos) {
    if (!rank) return '<span class="hint">unranked</span>';
    return withPos ? `${pos || ''} #${rank}` : `#${rank}`;
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
              Bench <strong>${s.suggested.name}</strong> (Boone ${rankCell(s.suggested.position, s.suggested.boone_rank, true)}, JJZ ${rankCell(s.suggested.position, s.suggested.jjz_rank, true)})
              outranks starter <strong>${s.starter.name}</strong> (Boone ${rankCell(s.starter.position, s.starter.boone_rank, true)}, JJZ ${rankCell(s.starter.position, s.starter.jjz_rank, true)})
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
                  <td>${rankCell(p.position, p.boone_rank)}</td>
                  <td>${rankCell(p.position, p.jjz_rank)}</td>
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
