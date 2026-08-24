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
  style.textContent = [
    '.cinema-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:#06070a;pointer-events:none;contain:strict;transform:translateZ(0);}',
    '.cinema-bg-video{width:100%;height:100%;object-fit:cover;object-position:center 68%;transform:translateZ(0);}',
    '.cinema-bg.is-static{background:radial-gradient(120% 80% at 18% -10%,rgba(212,176,122,.16),transparent 42%),radial-gradient(90% 70% at 92% 8%,rgba(90,140,200,.1),transparent 40%),linear-gradient(165deg,#0a0e14 0%,#07090d 48%,#050608 100%);}',
    '.cinema-bg-wash{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,rgba(212,176,122,.07),transparent 55%);}',
    '.cinema-bg-orb{position:absolute;border-radius:50%;filter:blur(48px);opacity:.45;will-change:transform;}',
    '.cinema-bg-orb.is-a{width:42vw;height:42vw;left:-8vw;top:18vh;background:rgba(212,176,122,.14);}',
    '.cinema-bg-orb.is-b{width:36vw;height:36vw;right:-6vw;bottom:8vh;background:rgba(80,130,190,.12);}',
    '@media (prefers-reduced-motion:no-preference){.cinema-bg-orb.is-a{animation:cinemaOrbA 18s ease-in-out infinite alternate}.cinema-bg-orb.is-b{animation:cinemaOrbB 22s ease-in-out infinite alternate}}',
    '@keyframes cinemaOrbA{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(4vw,3vh,0) scale(1.08)}}',
    '@keyframes cinemaOrbB{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(-3vw,-2vh,0) scale(1.06)}}',
    '.cinema-bg .cinema-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 46%,transparent 42%,rgba(0,0,0,.16) 78%,rgba(0,0,0,.5) 100%),linear-gradient(90deg,rgba(0,0,0,.4),transparent 22%,transparent 78%,rgba(0,0,0,.34)),linear-gradient(180deg,rgba(0,0,0,.28),transparent 28%,transparent 72%,rgba(0,0,0,.42));}',
    '.cinema-bg .grain{position:absolute;inset:0;pointer-events:none;opacity:.03;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 160 160\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.8\' numOctaves=\'1\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'160\' height=\'160\' filter=\'url(%23n)\' opacity=\'.5\'/%3E%3C/svg%3E");}',
    '@media (max-width:768px){.cinema-bg .grain,.cinema-bg-orb{display:none}}',
    'html,body{background:transparent !important;}',
    '.app-frame{background:transparent !important;}',
    '.main-column{background:transparent !important;}',
    '#match-hall,.match-hall{background:transparent !important;}',
    '.cinema-music-btn{display:none !important;}',
    'body[data-page="insight"] .page-main,body[data-page="discovery"] .page-main{--glass-card:transparent;--glass-border:rgba(255,255,255,0.1);--glass-shadow:none;}',
    '.card,.kpi-card,.job-card,.match-resume,.match-job-card,.evo-list,.evo-stat,.source-card,.quality-card,.proto-stat,.proto-banner,.module-card,.home-quick,.home-panel,.home-banner,.trend-hero,.match-upload-card,.match-summary-card,.match-agent-banner,.career-shell,.proto-track-panel{background:transparent !important;border:none !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}',
    '.home-quick:hover,.job-card:hover,.match-job-card:hover{background:rgba(255,255,255,0.04) !important;}',
    '.home-bottom .home-panel + .home-panel{border-left:1px solid rgba(255,255,255,0.08);}',
    '.home-kpi-grid{border-top:1px solid rgba(255,255,255,0.08);}',
    '.home-kpi{background:transparent !important;border:none !important;border-bottom:1px solid rgba(255,255,255,0.06) !important;border-right:1px solid rgba(255,255,255,0.06) !important;border-radius:0 !important;}',
    '.home-quick-grid{border-top:1px solid rgba(255,255,255,0.08);}',
    '.home-quick{border-radius:0 !important;border-right:1px solid rgba(255,255,255,0.06) !important;border-bottom:1px solid rgba(255,255,255,0.06) !important;}',
    '.card-header{border-bottom:1px solid rgba(255,255,255,0.08) !important;}',
    '.card + .card,.card[style*="margin"] + .card{margin-top:0 !important;border-top:1px solid rgba(255,255,255,0.08) !important;}',
    '.graph-filter-float-panel{background:rgba(8,12,20,0.82) !important;border:1px solid rgba(168,140,255,0.22) !important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}',
    '.graph-legend,.graph-stats{background:transparent !important;border:none !important;box-shadow:none !important;backdrop-filter:none !important;-webkit-backdrop-filter:none !important;}',
    'body[data-page="map"] .graph-detail{background:#FAF3E2 !important;border:1px solid rgba(184,134,11,.35) !important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 18px 44px rgba(120,90,20,.18) !important;color:#3A2E0E !important}',
    'body[data-page="map"] .graph-detail .btn{background:rgba(212,175,55,.14) !important;border:1px solid rgba(212,175,55,.4) !important;color:#8F6B0E !important;}',
    'body[data-page="map"] .graph-legend{background:rgba(28,22,8,.82) !important;backdrop-filter:blur(10px) !important;-webkit-backdrop-filter:blur(10px) !important;border:1px solid rgba(212,175,55,.35) !important;border-radius:10px !important;color:rgba(255,247,224,.9) !important;box-shadow:0 6px 20px rgba(0,0,0,.25) !important;}',
    'body[data-page="map"] .graph-stats{background:rgba(10,14,39,.85) !important;backdrop-filter:blur(10px) !important;-webkit-backdrop-filter:blur(10px) !important;border:1px solid rgba(255,255,255,.1) !important;border-radius:10px !important;color:#fff !important;}',
    '.btn,.btn-ghost{background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.14) !important;color:var(--text-dark) !important;box-shadow:none !important;}',
    '.btn-primary{background:linear-gradient(135deg,rgba(236,201,132,0.95),#c4a574) !important;border-color:transparent !important;color:#1a1208 !important;}',
    '.hub-tabs{background:rgba(255,255,255,0.05) !important;border:1px solid rgba(255,255,255,0.1) !important;box-shadow:none !important;}',
    '.filter-pill{background:rgba(255,255,255,0.06) !important;border:1px solid rgba(255,255,255,0.12) !important;}',
    '.change-item{background:rgba(255,255,255,0.05) !important;}',
    '.match-format,.match-summary-badge,.match-profile-chip,.match-path-node{background:rgba(255,255,255,0.06) !important;border-color:rgba(255,255,255,0.12) !important;color:var(--text-secondary) !important;}',
    '.match-gap-item,.path-deliverable{background:rgba(255,255,255,0.05) !important;border-color:rgba(255,255,255,0.1) !important;}',
    '.match-skeleton{background:rgba(255,255,255,0.08) !important;}',
    '.match-error{background:rgba(245,158,11,0.12) !important;border-color:rgba(245,158,11,0.3) !important;color:#fcd34d !important;}',
    '.upload-zone{background:rgba(255,255,255,0.05) !important;border-color:rgba(45,212,191,0.35) !important;}',
    '.proto-search input,.proto-select{background:rgba(255,255,255,0.06) !important;border-color:rgba(255,255,255,0.14) !important;color:var(--text-dark) !important;}',
    '#view-discovery .job-card.disc-proto.is-forecast,#view-discovery .disc-proto.is-forecast{background:rgba(240,180,41,0.08) !important;border-color:rgba(240,180,41,0.4) !important;}',
    '#view-discovery .proto-sec-head{border-bottom-color:rgba(255,255,255,0.12) !important;}',
    '.topbar-search,.header-search input{background:rgba(255,255,255,0.06) !important;border-color:rgba(255,255,255,0.14) !important;color:var(--text-dark) !important;}',
    '.graph-canvas{background:radial-gradient(ellipse at 28% 18%,rgba(70,40,120,0.35) 0%,#0a1020 48%,#06070a 100%) !important;border:1px solid rgba(140,120,255,0.18) !important;}',
    'body[data-page="map"] .graph-canvas:not(.canvas-panel){background:transparent !important;border:1px solid transparent !important;box-shadow:none !important;}',
    'body[data-page="map"] .graph-canvas.canvas-panel{background:rgba(14,20,16,.45) !important;backdrop-filter:blur(12px) !important;-webkit-backdrop-filter:blur(12px) !important;border:1px solid rgba(212,175,55,.3) !important;box-shadow:0 8px 32px rgba(10,8,2,.24) !important;}',
    '::-webkit-scrollbar{width:8px;height:8px}',
    '::-webkit-scrollbar-track{background:transparent}',
    '::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.16);border-radius:4px}'
  ].join('\n');
  document.head.appendChild(style);
})();
