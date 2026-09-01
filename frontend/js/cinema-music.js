/* 轻量背景音乐：保留 API，不再注入左下角播放按钮 */
(function () {
  if (window.__cinemaMusicLoaded) return;
  window.__cinemaMusicLoaded = true;

  function base() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path) || /\/pages\/news\//.test(path)) return '../../';
    if (/\/pages\//.test(path)) return '../';
    return './';
  }

  const B = base();
  const SRC = B + 'assets/bg/background-music.mp3';
  const DEFAULT_VOLUME = 0.5;
  let audio = null;

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.src = SRC;
    return audio;
  }

  function play() {
    const a = ensureAudio();
    return a.play().catch(function () {});
  }

  function pause() {
    if (audio) audio.pause();
  }

  function toggle() {
    const a = ensureAudio();
    if (a.paused) play();
    else pause();
  }

  /* 移除历史残留的播放按钮 */
  function removeLegacyFab() {
    document.querySelectorAll('.cinema-music-btn').forEach(function (el) {
      el.remove();
    });
  }

  removeLegacyFab();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyFab);
  }

  window.__cinemaMusic = { toggle: toggle, play: play, pause: pause };
})();
