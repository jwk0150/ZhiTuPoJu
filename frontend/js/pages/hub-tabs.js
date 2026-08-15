(function () {
  window.initHubTabs = function (opts) {
    opts = opts || {};
    const root = document.querySelector(opts.root || '.hub-tabs');
    if (!root) return;
    const hub = root.closest('main') || document;
    const tabs = root.querySelectorAll('[data-hub-tab]');
    const panels = hub.querySelectorAll('[data-hub-panel]');

    function activate(id) {
      tabs.forEach(function (t) {
        t.classList.toggle('active', t.getAttribute('data-hub-tab') === id);
      });
      panels.forEach(function (p) {
        p.classList.toggle('active', p.getAttribute('data-hub-panel') === id);
      });
      if (typeof opts.onChange === 'function') opts.onChange(id);
      try {
        const url = new URL(location.href);
        if (id && id !== opts.defaultTab) url.searchParams.set('tab', id);
        else url.searchParams.delete('tab');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (_) {}
    }

    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        activate(t.getAttribute('data-hub-tab'));
      });
    });

    const initial = opts.initial || tabs[0] && tabs[0].getAttribute('data-hub-tab');
    if (initial) activate(initial);
  };
})();
