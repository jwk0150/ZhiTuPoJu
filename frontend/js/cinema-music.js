/* 轻量背景音乐控制器：右下角悬浮播放/暂停按钮 */
(function () {
  if (window.__cinemaMusicLoaded) return;
  window.__cinemaMusicLoaded = true;

  function base() {
    const path = String(location.pathname || '').replace(/\\/g, '/');
    if (/\/pages\/more\//.test(path)) return '../../';
    if (/\/pages\//.test(path)) return '../';
    return '';
  }

  const B = base();
  const SRC = B + 'assets/bg/background-music.mp3';
  const DEFAULT_VOLUME = 0.5;

  let audio = null;
  let btn = null;

  function buildButton() {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cinema-music-btn';
    btn.setAttribute('aria-label', '播放背景音乐');
    btn.innerHTML =
      '<svg class="cm-icon-play" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<polygon points="6 3 20 12 6 21 6 3"/>' +
      '</svg>' +
      '<svg class="cm-icon-pause" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">' +
        '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' +
      '</svg>';
    document.body.appendChild(btn);
    btn.addEventListener('click', toggle);
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.preload = 'auto';
    return audio;
  }

  function toggle() {
    const a = ensureAudio();
    if (a.paused) {
      a.play().then(function () { update(true); }).catch(function () {});
    } else {
      a.pause();
      update(false);
    }
  }

  function update(playing) {
    if (!btn) return;
    btn.classList.toggle('is-playing', playing);
    btn.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
    const play = btn.querySelector('.cm-icon-play');
    const pause = btn.querySelector('.cm-icon-pause');
    if (play && pause) {
      play.style.display = playing ? 'none' : 'block';
      pause.style.display = playing ? 'block' : 'none';
    }
  }

  function injectStyle() {
    if (document.getElementById('cinema-music-style')) return;
    const s = document.createElement('style');
    s.id = 'cinema-music-style';
    s.textContent =
      '.cinema-music-btn{position:fixed;left:20px;bottom:20px;z-index:65;width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(10,12,18,.45);color:rgba(255,255,255,.86);cursor:pointer;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:transform .2s,border-color .2s,background .2s;}' +
      '.cinema-music-btn:hover{transform:scale(1.08);border-color:rgba(255,255,255,.36);background:rgba(10,12,18,.62);}' +
      '.cinema-music-btn svg{width:20px;height:20px;}' +
      '.cinema-music-btn.is-playing{color:var(--signal,#3DD5E5);border-color:rgba(61,213,229,.5);}';
    document.head.appendChild(s);
  }

  injectStyle();
  buildButton();
  window.__cinemaMusic = { toggle: toggle, play: function () { const a = ensureAudio(); a.play().then(function () { update(true); }).catch(function () {}); }, pause: function () { if (audio) { audio.pause(); update(false); } } };
})();
