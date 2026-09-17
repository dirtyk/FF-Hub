// Sleeper connect flow: username -> user_id -> leagues -> pick league+team -> load.
(function () {
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
      setStatus(connectStatus, `Found user_id ${user.user_id}. Fetching leagues...`);
      leaguesCache = await Api.get(`/api/sleeper/leagues/${user.user_id}`);
      if (leaguesCache.length === 0) {
        setStatus(connectStatus, 'No leagues found for this season.', 'error');
        return;
      }
      // Remembered so switching leagues later, or reopening the app, doesn't
      // require looking the username up again.
      Store.username = username;
      Store.sleeperUserId = user.user_id;
      Store.leagues = leaguesCache;
      populateLeagueOptions();
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

  function populateLeagueOptions() {
    leagueSelect.innerHTML = leaguesCache
      .map((l) => `<option value="${l.league_id}">${l.name}</option>`)
      .join('');
    leagueSelectCard.hidden = false;
    const currentlyLoaded = Store.league;
    if (currentlyLoaded && leaguesCache.some((l) => l.league_id === currentlyLoaded.league_id)) {
      leagueSelect.value = currentlyLoaded.league_id;
    }
  }

  function renderTeamOptions(full) {
    teamSelect.innerHTML = full.teams
      .map((t) => `<option value="${t.roster_id}">${t.owner_name}</option>`)
      .join('');
    // Sleeper's roster_id is just 1..N *within* a league, not a global id, so
    // a roster_id remembered from a different league can coincidentally match
    // a different team here. Prefer matching by the logged-in Sleeper user's
    // own id, which is stable across every league for that account.
    const myTeam = Store.sleeperUserId && full.teams.find((t) => t.owner_id === Store.sleeperUserId);
    if (myTeam) {
      teamSelect.value = String(myTeam.roster_id);
      Store.rosterId = String(myTeam.roster_id);
    } else if (Store.rosterId && full.teams.some((t) => String(t.roster_id) === Store.rosterId)) {
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

  // Restore state on load: prefill the username, repopulate the full league
  // list (so switching leagues doesn't require re-running Find Leagues), and
  // re-show whichever league/team was loaded last.
  if (Store.username) usernameInput.value = Store.username;

  const savedLeagues = Store.leagues;
  const existingFull = Store.league;
  if (savedLeagues && savedLeagues.length) {
    leaguesCache = savedLeagues;
    populateLeagueOptions();
  } else if (existingFull) {
    // Older saved state from before the full league list was remembered.
    leaguesCache = [existingFull];
    leagueSelect.innerHTML = `<option value="${existingFull.league_id}">${existingFull.name}</option>`;
    leagueSelectCard.hidden = false;
  }
  if (existingFull) {
    renderTeamOptions(existingFull);
    renderSummary(existingFull);
  }
})();
