// Tab switching + shared league badge. Loaded last so window.FFHub already
// has the hooks registered by trade.js / starters.js.
(function () {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  const badge = document.getElementById('league-badge');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'starters' && window.FFHub.loadStartersComparison) {
        window.FFHub.loadStartersComparison();
      }
    });
  });

  function updateLeagueBadge() {
    const league = Store.league;
    badge.textContent = league ? `League: ${league.name}` : 'No league loaded';
  }

  window.FFHub = window.FFHub || {};
  window.FFHub.updateLeagueBadge = updateLeagueBadge;
  updateLeagueBadge();
})();
