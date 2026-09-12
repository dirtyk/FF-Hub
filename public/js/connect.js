// Sleeper connect flow: username -> user_id -> leagues -> pick league+team -> load.
(function () {
  let foundUserId = null;
  let leaguesCache = [];

  const usernameInput = document.getElementById('sleeper-username');
  const findBtn = document.getElementById('find-leagues-btn');
  const connectStatus = document.getElementById('connect-status');
  const leagueSelectCard = document.getElementById('league-select-card');
  const leagueSelect = document.getElementById('league-select');
  const teamSelect = document.getElementById('team-select');
  const loadBtn = document.getElementById('load-league-btn');
  const loadStatus = document.getElementById('load-status');
  const summaryCard = document.getElementById('league-summary-card');
  const summaryDiv = document.getElementById('league-summary');

  function setStatus(el, msg, cls) {
    el.textContent = msg;
    el.className = 'status' + (cls ? ' ' + cls : '');
  }

  findBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) return setStatus(connectStatus, 'Enter a Sleeper username.', 'error');
    setStatus(connectStatus, 'Looking up user...');
    try {
      const user = await Api.get(`/api/sleeper/user/${encodeURIComponent(username)}`);
      foundUserId = user.user_id;
      setStatus(connectStatus, `Found user_id ${user.user_id}. Fetching leagues...`);
      leaguesCache = await Api.get(`/api/sleeper/leagues/${foundUserId}`);
      if (leaguesCache.length === 0) {
        setStatus(connectStatus, 'No leagues found for this season.', 'error');
        return;
      }
      leagueSelect.innerHTML = leaguesCache
        .map((l) => `<option value="${l.league_id}">${l.name}</option>`)
        .join('');
      leagueSelectCard.hidden = false;
      setStatus(connectStatus, `Found ${leaguesCache.length} league(s).`, 'ok');
    } catch (e) {
      setStatus(connectStatus, e.message, 'error');
    }
  });

  loadBtn.addEventListener('click', async () => {
    const leagueId = leagueSelect.value;
    if (!leagueId) return;
    setStatus(loadStatus, 'Loading league...');
    try {
      const full = await Api.get(`/api/sleeper/league/${leagueId}/full`);
      Store.league = full;
      renderTeamOptions(full);
      renderSummary(full);
      window.FFHub.updateLeagueBadge();
      setStatus(loadStatus, 'League loaded.', 'ok');
    } catch (e) {
      setStatus(loadStatus, e.message, 'error');
    }
  });

  teamSelect.addEventListener('change', () => {
    Store.rosterId = teamSelect.value;
  });

  function renderTeamOptions(full) {
    teamSelect.innerHTML = full.teams
      .map((t) => `<option value="${t.roster_id}">${t.owner_name}</option>`)
      .join('');
    if (Store.rosterId && full.teams.some((t) => String(t.roster_id) === Store.rosterId)) {
      teamSelect.value = Store.rosterId;
    } else {
      Store.rosterId = teamSelect.value;
    }
  }

  function renderSummary(full) {
    summaryCard.hidden = false;
    summaryDiv.innerHTML = `
      <p><strong>${full.name}</strong> (${full.season})</p>
      <p>${full.teams.length} teams. Roster slots: ${full.roster_positions.filter((p) => p !== 'BN').join(', ')}</p>
    `;
  }

  // Restore state on load if a league was already saved.
  const existing = Store.league;
  if (existing) {
    leaguesCache = [existing];
    leagueSelect.innerHTML = `<option value="${existing.league_id}">${existing.name}</option>`;
    leagueSelectCard.hidden = false;
    renderTeamOptions(existing);
    renderSummary(existing);
  }
})();
