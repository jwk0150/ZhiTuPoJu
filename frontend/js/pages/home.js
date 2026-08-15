(function () {
  if (!window.Shell || typeof window.Shell.mount !== 'function') {
    return;
  }

  window.Shell.mount({
    pageId: 'home',
    title: '演示路径',
    subtitle: '数据 → 图谱 → 匹配'
  });

  var hrefs = window.PAGE_HREF || {};
  var nodes = document.querySelectorAll('[data-page-href]');
  for (var i = 0; i < nodes.length; i++) {
    var key = nodes[i].getAttribute('data-page-href');
    if (key && hrefs[key]) {
      nodes[i].setAttribute('href', hrefs[key]);
    }
  }

  var canvas = document.getElementById('home-particles');
  if (canvas && window.TealParticles) {
    window.TealParticles.mount(canvas);
  }
})();
