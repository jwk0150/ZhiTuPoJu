/* 平台页面统一背景
 * 登录后页面默认：轻量 CSS 氛围（无视频解码，控内存 ≤350MB）
 * 入口页 / localStorage.zhitu_cinema_video=1 时才播视频
 */
(function () {
  function base() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path) || /\/pages\/news\//.test(path)) return '../../';
    if (/\/pages\//.test(path)) return '../';
    return './';
  }

  function isAppPage() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    return /\/pages\//.test(path);
  }

  function videoAllowed() {
    try {
      if (localStorage.getItem('zhitu_cinema_video') === '1') return true;
      if (localStorage.getItem('zhitu_cinema_video') === '0') return false;
    } catch (_) {}
    return !isAppPage();
  }

  const B = base();
  const LICK_START = 6.6;
  const LICK_END = 9.85;
  const PLAY_RATE = 0.72;
  const allowVideo = videoAllowed();

  if (!document.getElementById('cinema-bg')) {
    const stage = document.createElement('div');
    stage.id = 'cinema-bg';
    stage.className = 'cinema-bg' + (allowVideo ? '' : ' is-static');
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML =
      (allowVideo
        ? '<video class="cinema-bg-video" muted playsinline preload="none"></video>'
        : '<div class="cinema-bg-wash"></div><div class="cinema-bg-orb is-a"></div><div class="cinema-bg-orb is-b"></div>') +
      '<div class="cinema-vignette"></div>' +
      '<div class="grain"></div>';
    document.body.insertBefore(stage, document.body.firstChild);

    if (allowVideo) {
      const video = stage.querySelector('.cinema-bg-video');
      const src = B + 'assets/bg/scene3.mp4';
      let seeking = false;
      let started = false;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const applyPlayRate = () => {
        try {
          video.playbackRate = reduceMotion ? 1 : PLAY_RATE;
        } catch (_) {}
      };

      const wrapToLick = () => {
        if (seeking) return;
        seeking = true;
        applyPlayRate();
        try {
          video.currentTime = LICK_START;
        } catch (_) {}
        if (video.paused) video.play().catch(function () {});
        const unlock = () => {
          seeking = false;
        };
        video.addEventListener('seeked', unlock, { once: true });
        window.setTimeout(unlock, 180);
      };

      const onTime = () => {
        if (seeking) return;
        applyPlayRate();
        if (video.currentTime >= LICK_END) wrapToLick();
      };

      const startBg = () => {
        if (started) return;
        started = true;
        video.preload = 'metadata';
        video.loop = false;
        if (!video.getAttribute('src')) video.src = src;
        video.addEventListener('timeupdate', onTime);
        video.addEventListener('ended', wrapToLick);
        const kick = () => {
          try {
            if (video.readyState >= 1 && video.currentTime < LICK_START - 0.05) {
              video.currentTime = LICK_START;
            }
          } catch (_) {}
          applyPlayRate();
          video.play().catch(function () {});
        };
        if (video.readyState >= 1) kick();
        else video.addEventListener('loadedmetadata', kick, { once: true });
      };

      if ('requestIdleCallback' in window) window.requestIdleCallback(startBg, { timeout: 4000 });
      else window.setTimeout(startBg, 1200);

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) video.pause();
        else if (video.getAttribute('src')) video.play().catch(function () {});
      });
      window.addEventListener('pagehide', function () {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (_) {}
      });
    }
  }

  if (document.getElementById('cinema-theme')) return;
  const style = document.createElement('style');
  style.id = 'cinema-theme';
  const atm = B + 'assets/news/bg-atmosphere-light.png';
  style.textContent = [
    /* —— 全站背景 = 新闻页原亮色氛围 —— */
    '.cinema-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:#F5F2ED;pointer-events:none;contain:strict;transform:translateZ(0);}',
    '.cinema-bg-video{width:100%;height:100%;object-fit:cover;object-position:center 68%;transform:translateZ(0);filter:brightness(1.08) contrast(1.02) saturate(1.04);opacity:.55;}',
    '.cinema-bg.is-static{background:#F5F2ED;}',
    '.cinema-bg-wash{position:absolute;inset:0;background-image:url("' + atm + '");background-size:cover;background-position:center top;background-repeat:no-repeat;opacity:.92;mask-image:radial-gradient(120% 90% at 50% 35%,#000 55%,transparent 100%);-webkit-mask-image:radial-gradient(120% 90% at 50% 35%,#000 55%,transparent 100%);}',
    '.cinema-bg-orb{display:none;}',
    '.cinema-bg .cinema-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 40%,transparent 50%,rgba(245,242,237,.35) 100%);}',
    '.cinema-bg .grain{position:absolute;inset:0;pointer-events:none;opacity:.02;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 160 160\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.8\' numOctaves=\'1\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'160\' height=\'160\' filter=\'url(%23n)\' opacity=\'.5\'/%3E%3C/svg%3E");}',
    '@media (max-width:768px){.cinema-bg .grain{display:none}}',
    'html,body{background:#F5F2ED !important;color:#1A1A1A !important;}',
    '.app-frame,.main-column,#match-hall,.match-hall,.page-main,.main,.content,.app,.graph-layout{background:transparent !important;}',
    '.cinema-music-btn{display:none !important;}',
    /* Shell 顶栏：亮色玻璃 */
    '.topbar,.app-topbar,#app-shell .topbar,.topnav{background:rgba(255,255,255,.82) !important;border-bottom:1px solid rgba(0,0,0,.06) !important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#1A1A1A !important;}',
    '.topbar a,.topbar button,.nav-item,.shell-nav a,.topnav a,.topnav button{color:#3F4654 !important;}',
    '.nav-item.is-active,.nav-item.active,.shell-nav a.is-active,.topbar .is-active{color:#1A1A1A !important;border-color:rgba(168,139,78,.4) !important;background:rgba(168,139,78,.12) !important;box-shadow:none !important;}',
    '.brand,.brand-name,.logo-text,.topnav-brand,.topnav-brand-title{color:#8B7340 !important;}',
    /* 二级模块通用可读字色 */
    '.dd-page,.de-page,.df-page,.vault,#view-discovery{color:#1A1A1A !important;}',
    '.dd-page .dd-title,.de-page h1,.df-page h1,.vault-title,.dh-title{color:#1A1A1A !important;}',
    '.dd-page .dd-crumb,.vault-lead,.vault-user,.dh-lead,.dh-meta{color:#4B5563 !important;}',
    /* 简历探索弹层 */
    '.rx-modal{background:linear-gradient(165deg,#fff 0%,#FAF8F5 55%,#F5F2ED 100%) !important;border:1px solid rgba(0,0,0,.08) !important;}',
    '.rx-head{background:rgba(255,255,255,.95) !important;border-bottom:1px solid rgba(0,0,0,.06) !important;}',
    '.rx-head-title b{color:#1A1A1A !important;}',
    '.rx-head-title span,.rx-btn{color:#4B5563 !important;}',
    '.rx-frame{background:#F5F2ED !important;}',
    '.topnav-resume{color:#8B7340 !important;border-color:rgba(168,139,78,.4) !important;}',
    /* 通用卡片：白纸面 */
    'body[data-page="insight"] .page-main,body[data-page="discovery"] .page-main{--glass-card:#fff;--glass-border:rgba(0,0,0,.08);--glass-shadow:0 8px 24px rgba(60,45,30,.06);}',
    '.card,.kpi-card,.job-card,.match-job-card,.module-card,.home-panel,.trend-hero{background:#fff !important;border:1px solid rgba(0,0,0,.08) !important;box-shadow:0 4px 16px rgba(60,45,30,.05) !important;color:#1A1A1A !important;}',
    '.job-card:hover,.match-job-card:hover{background:#FAF8F5 !important;}',
    '.btn,.btn-ghost{background:#fff !important;border:1px solid rgba(0,0,0,.12) !important;color:#1A1A1A !important;box-shadow:none !important;}',
    '.btn-primary{background:linear-gradient(135deg,#C4A86B,#A88B4E) !important;border-color:transparent !important;color:#1a1208 !important;}',
    '.hub-tabs{background:#FAF8F5 !important;border:1px solid rgba(0,0,0,.08) !important;}',
    '.filter-pill,.proto-search input,.proto-select,.topbar-search,.header-search input{background:#fff !important;border:1px solid rgba(0,0,0,.1) !important;color:#1A1A1A !important;}',
    /* 地图：浅底上的奶油面板 */
    '.graph-filter-float-panel,body[data-page="map"] .graph-filter-float-panel{background:rgba(255,255,255,.92) !important;border:1px solid rgba(0,0,0,.1) !important;color:#1A1A1A !important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}',
    'body[data-page="map"] .graph-detail{background:#fff !important;background-image:none !important;border:1px solid rgba(0,0,0,.1) !important;box-shadow:0 12px 32px rgba(60,45,30,.1) !important;color:#1A1A1A !important;}',
    'body[data-page="map"] .graph-detail .btn{background:rgba(168,139,78,.12) !important;border:1px solid rgba(168,139,78,.35) !important;color:#8B7340 !important;}',
    'body[data-page="map"] .graph-detail .detail-name,body[data-page="map"] .graph-detail h2,body[data-page="map"] .graph-detail h3,body[data-page="map"] .graph-detail h4,body[data-page="map"] #talent-hover-name{color:#1A1A1A !important;}',
    'body[data-page="map"] .graph-detail .detail-cat,body[data-page="map"] .graph-detail .detail-empty p,body[data-page="map"] .graph-detail .detail-stat-label,body[data-page="map"] .graph-detail .detail-section-title{color:#6B7280 !important;}',
    'body[data-page="map"] .graph-detail .detail-stat-value{color:#A88B4E !important;}',
    'body[data-page="map"] .graph-detail .detail-stat,body[data-page="map"] .graph-detail .detail-rel-item{background:#FAF8F5 !important;}',
    'body[data-page="map"] .graph-detail .detail-header{border-bottom-color:rgba(0,0,0,.08) !important;}',
    'body[data-page="map"] .graph-legend,body[data-page="map"] .graph-stats{background:rgba(255,255,255,.9) !important;border:1px solid rgba(0,0,0,.1) !important;color:#1A1A1A !important;box-shadow:0 4px 16px rgba(60,45,30,.08) !important;}',
    'body[data-page="map"] .graph-canvas:not(.canvas-panel),body[data-page="map"] .graph-canvas{background:radial-gradient(ellipse at 40% 30%,#F8F4EC 0%,#F5F2ED 55%,#EFEAE2 100%) !important;background-image:radial-gradient(ellipse at 40% 30%,#F8F4EC 0%,#F5F2ED 55%,#EFEAE2 100%) !important;border:1px solid rgba(0,0,0,.06) !important;box-shadow:none !important;}',
    'body[data-page="map"] .graph-canvas.canvas-panel{background:rgba(255,255,255,.55) !important;border:1px solid rgba(0,0,0,.08) !important;box-shadow:0 8px 24px rgba(60,45,30,.06) !important;}',
    '.graph-canvas{background:radial-gradient(ellipse at 40% 30%,#F8F4EC 0%,#F5F2ED 55%,#EFEAE2 100%) !important;border:1px solid rgba(0,0,0,.08) !important;}',
    '::-webkit-scrollbar{width:8px;height:8px}',
    '::-webkit-scrollbar-track{background:transparent}',
    '::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.16);border-radius:4px}'
  ].join('\n');
  document.head.appendChild(style);
})();
