(function () {
  // 管理端统一守卫：未登录用户访问任意管理页面时，回到视频入口页（含登录区）
  try {
    var user = JSON.parse(localStorage.getItem('zhitu_user') || 'null');
    if (!user) {
      var path = location.pathname.split('/').pop();
      // 从 index.html 跳转需要带 pages/ 前缀
      var ret = encodeURIComponent((path === 'index.html' ? '' : 'pages/') + path + location.search + location.hash);
      location.replace('../index.html?return=' + ret);
    }
  } catch (_) {
    location.replace('../index.html');
  }
})();