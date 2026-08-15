(function () {
  function hrefBase() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path)) return '../';
    if (/\/pages\//.test(path)) return '';
    return 'pages/';
  }

  /** Legacy helper: prefer real page routes over portal iframe. */
  window.mountEmbedPage = function (opts) {
    opts = opts || {};
    const pageId = opts.pageId || opts.view || 'home';
    const b = hrefBase();
    const map = {
      home: b + 'home.html',
      map: b + 'map.html',
      evolution: b + 'evolution.html',
      discovery: b + 'discovery.html',
      match: b + 'match.html',
      qa: b + 'qa.html',
      collection: b + 'more/collection.html',
      analysis: b + 'more/analysis.html',
      quality: b + 'more/quality.html',
      settings: b + 'more/settings.html',
      profile: b + 'profile.html'
    };
    const target = map[pageId] || map.home;
    if (window.Shell) {
      window.Shell.mount({
        pageId: pageId,
        title: opts.title || '',
        subtitle: opts.subtitle || ''
      });
    }
    location.replace(target);
  };
})();
