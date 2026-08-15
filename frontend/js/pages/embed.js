(function () {
  function cssPrefix() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path)) return '../../';
    if (/\/pages\//.test(path)) return '../';
    return './';
  }

  window.mountEmbedPage = function (opts) {
    opts = opts || {};
    const view = opts.view;
    const pageId = opts.pageId;
    const title = opts.title || '';
    const subtitle = opts.subtitle || '';
    const prefix = cssPrefix();
    const src = prefix + 'portal.html?embed=1#view-' + encodeURIComponent(view);

    if (window.Shell) {
      window.Shell.mount({ pageId: pageId, title: title, subtitle: subtitle, embed: true });
    }

    const main = document.getElementById('page-main');
    if (!main) return;
    main.classList.add('page-main--embed');
    main.innerHTML = '<iframe class="embed-frame" title="' + (title || view) + '" src="' + src + '"></iframe>';
  };
})();
