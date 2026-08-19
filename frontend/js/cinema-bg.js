/* 平台页面统一背景：全程同速，无停顿直接帧循环 */
(function () {
  function base() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path)) return '../../';
    if (/\/pages\//.test(path)) return '../';
    return '';
  }

  const B = base();
  const LICK_START = 6.6;
  const LICK_END = 9.85;
  const PLAY_RATE = 0.72;

  if (!document.getElementById('cinema-bg')) {
    const stage = document.createElement('div');
    stage.id = 'cinema-bg';
    stage.className = 'cinema-bg';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML =
      '<video class="cinema-bg-video" muted playsinline preload="metadata"></video>' +
      '<div class="cinema-vignette"></div>' +
      '<div class="grain"></div>';
    document.body.insertBefore(stage, document.body.firstChild);

    const video = stage.querySelector('.cinema-bg-video');
    const src = B + 'assets/bg/scene3.mp4';
    let seeking = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const applyPlayRate = () => {
      try { video.playbackRate = reduceMotion ? 1 : PLAY_RATE; } catch (_) {}
    };

    const wrapToLick = () => {
      if (seeking) return;
      seeking = true;
      applyPlayRate();
      try { video.currentTime = LICK_START; } catch (_) {}
      if (video.paused) video.play().catch(function () {});
      const unlock = () => { seeking = false; };
      video.addEventListener('seeked', unlock, { once: true });
      window.setTimeout(unlock, 180);
    };

    const onTime = () => {
      if (seeking) return;
      applyPlayRate();
      if (video.currentTime >= LICK_END) wrapToLick();
    };

    const startBg = () => {
      if (!video.src) video.src = src;
      video.loop = false;
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', wrapToLick);
      video.addEventListener('timeupdate', onTime);
      video.addEventListener('ended', wrapToLick);

      const bootFromBlob = async () => {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          video.src = URL.createObjectURL(blob);
          await new Promise((resolve) => {
            if (video.readyState >= 1) return resolve();
            video.addEventListener('loadedmetadata', resolve, { once: true });
            window.setTimeout(resolve, 4000);
          });
        } catch (_) {
          if (!video.src) video.src = src;
        }
        try { video.currentTime = LICK_START; } catch (_) {}
        applyPlayRate();
        video.play().catch(function () {});
      };
      bootFromBlob();
    };

    if ('requestIdleCallback' in window) window.requestIdleCallback(startBg, { timeout: 1800 });
    else window.setTimeout(startBg, 400);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) video.pause();
      else if (video.src) video.play().catch(function () {});
    });
  }

  if (document.getElementById('cinema-theme')) return;
  const style = document.createElement('style');
  style.id = 'cinema-theme';
  style.textContent = [
    '.cinema-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:#06070a;pointer-events:none;contain:strict;transform:translateZ(0);}',
    '.cinema-bg-video{width:100%;height:100%;object-fit:cover;object-position:center 68%;transform:translateZ(0);}',
    '.cinema-bg .cinema-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 46%,transparent 42%,rgba(0,0,0,.16) 78%,rgba(0,0,0,.5) 100%),linear-gradient(90deg,rgba(0,0,0,.4),transparent 22%,transparent 78%,rgba(0,0,0,.34)),linear-gradient(180deg,rgba(0,0,0,.28),transparent 28%,transparent 72%,rgba(0,0,0,.42));}',
    '.cinema-bg .grain{position:absolute;inset:0;pointer-events:none;opacity:.03;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg viewBox=\'0 0 160 160\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.8\' numOctaves=\'1\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'160\' height=\'160\' filter=\'url(%23n)\' opacity=\'.5\'/%3E%3C/svg%3E");}',
    '@media (max-width:768px){.cinema-bg .grain{display:none}}',
    'html,body{background:transparent !important;}',
    '.app-frame{background:transparent !important;}',
    '.main-column{background:transparent !important;}',
    '.page-main{background:transparent !important;}',
    'body[data-page="insight"] .page-main,body[data-page="discovery"] .page-main{--glass-card:rgba(255,255,255,0.06);--glass-border:rgba(255,255,255,0.14);--glass-shadow:0 12px 32px rgba(0,0,0,0.32);}',
    '.card,.kpi-card,.job-card,.graph-filter,.graph-detail,.match-resume,.match-job-card,.evo-list,.evo-stat,.source-card,.quality-card,.proto-stat,.proto-banner,.header,.icon-btn,.btn,.btn-ghost,.module-card,.home-quick,.home-panel{background:rgba(12,16,24,0.72) !important;border:1px solid rgba(255,255,255,0.12) !important;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}',
    '@media (max-width:768px){.card,.kpi-card,.job-card,.graph-filter,.graph-detail,.match-resume,.match-job-card,.evo-list,.evo-stat,.source-card,.quality-card,.proto-stat,.proto-banner,.header,.icon-btn,.btn,.btn-ghost,.module-card,.home-quick,.home-panel{backdrop-filter:none !important;-webkit-backdrop-filter:none !important;background:rgba(10,14,22,0.88) !important;}}',
    '.btn-primary{background:linear-gradient(135deg,#1FC8D9,#1EA8E8) !important;border-color:transparent !important;color:#fff !important;}',
    '.home-kpi{background:rgba(255,255,255,0.04) !important;border:1px solid rgba(255,255,255,0.1) !important;}',
    '.home-banner{background:radial-gradient(ellipse 50% 80% at 88% 40%,rgba(31,200,217,0.14),transparent 60%),linear-gradient(115deg,rgba(15,25,36,0.85),rgba(20,30,42,0.7) 50%,rgba(12,20,30,0.85)) !important;border:1px solid rgba(255,255,255,0.12) !important;}',
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
    'body[data-page="insight"] .trend-hero{background:radial-gradient(ellipse 50% 80% at 90% 30%,rgba(31,200,217,0.16),transparent 55%),linear-gradient(115deg,rgba(15,25,36,0.85),rgba(18,28,40,0.75) 50%,rgba(12,20,30,0.85)) !important;border:1px solid rgba(255,255,255,0.14) !important;}',
    '.topbar-search,.header-search input{background:rgba(255,255,255,0.06) !important;border-color:rgba(255,255,255,0.14) !important;color:var(--text-dark) !important;}',
    '.graph-canvas{background:radial-gradient(ellipse at 30% 20%,#0d1a18 0%,#080d15 55%,#06070a 100%) !important;}',
    '::-webkit-scrollbar{width:8px;height:8px}',
    '::-webkit-scrollbar-track{background:transparent}',
    '::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.16);border-radius:4px}'
  ].join('\n');
  document.head.appendChild(style);
})();
