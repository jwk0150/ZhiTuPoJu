(function () {
  if (window.Shell && typeof window.Shell.mount === 'function') {
    window.Shell.mount({
      pageId: 'home',
      title: '工作台',
      subtitle: '执图破局 · 数字人才图谱平台'
    });
  }

  document.querySelectorAll('[data-page-href]').forEach(function (el) {
    const key = el.getAttribute('data-page-href');
    if (window.PAGE_HREF && window.PAGE_HREF[key]) {
      el.setAttribute('href', window.PAGE_HREF[key]);
    }
  });
})();
