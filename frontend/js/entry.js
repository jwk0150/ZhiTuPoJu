/* 执图破局 · 场景滚动式入口逻辑（三页：首页 / 项目介绍 / 登录） */
(function () {
  const videos = {
    scene1: document.getElementById('scene1Video'),
    transition: document.getElementById('transitionVideo'),
    scene2: document.getElementById('scene2Video'),
    scene2Idle: document.getElementById('scene2IdleVideo'),
    scene3: document.getElementById('scene3Video')
  };

  const siteShell = document.querySelector('.site-shell');
  const contentTrack = document.getElementById('contentTrack');
  const introTypewriter = document.getElementById('introTypewriter');
  const introPanel = document.querySelector('.intro-panel');
  const progressBar = document.getElementById('progressBar');
  const stateText = document.getElementById('stateText');
  const scene2Cards = document.querySelector('.project-cards-grid');

  const INTRO_LINES = [
    '把散落的招聘文本收成',
    '可核对的岗位—能力结构。',
    '看分布、读变化、发现新岗位，',
    '再把人和岗放到同一套语言里对照。'
  ];
  const INTRO_SCRIPT = INTRO_LINES.join('\n');
  const INTRO_HTML = INTRO_LINES.join('<br>');

  let phase = 'scene1-idle';
  let isLocked = false;
  let transitionDuration = 8.833;
  let scene2Duration = 8.767;
  let scene2IdleStarted = false;
  let scene2SkipStarted = false;
  let scene2CopyRevealed = false;
  let isScene2Leaving = false;
  let scene2ExitTimer = null;
  const scene2ExitDelay = 320;
  /** scene3：先播跳出序章，登录卡早入；舔爪仍在 LICK_START 后循环 */
  const SCENE3_LICK_START = 6.6;
  const SCENE3_LICK_END = 9.85;
  const SCENE3_LOGIN_AT = 1.15;
  const SCENE3_PLAY_RATE = 0.72;
  /** 1→2 过场看到后半段再滑入介绍 */
  const SCENE2_COPY_AT = 5.2;
  const SCENE2_TRACK_MS = 1280;
  /** 第二幕（过场 + 介绍）略加快 */
  const SCENE2_PLAY_RATE = 1.22;
  let rafId = 0;
  let wasHidden = false;
  const warmed = new WeakSet();
  const FADE_MS = 900;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let typewriterTimer = 0;
  let typewriterToken = 0;
  let typewriterTween = null;

  if (typeof gsap !== 'undefined' && typeof TextPlugin !== 'undefined') {
    gsap.registerPlugin(TextPlugin);
  }
  let moveGen = 0;
  let scene3Gen = 0;
  let scene3JumpCleanup = () => {};
  let lastWheelAt = 0;
  let lastAdvanceAt = 0;
  let touchStartY = 0;
  let touchStartX = 0;
  let isTouching = false;
  let lastTouchAt = 0;
  const TOUCH_THRESHOLD = 60;
  const TOUCH_THROTTLE_MS = 680;
  const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, label, .project-card, .project-modal-overlay, .login-card, .brand, .platform-nav, .platform-enter, .platform-status, .intro-actions';

  const updateAppHeight = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  };

  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

  const setRootDuration = () => {};

  const scene2Rate = () => (reduceMotion ? 1 : SCENE2_PLAY_RATE);

  const applyScene2Rate = (video) => {
    if (!video) return;
    try { video.playbackRate = scene2Rate(); } catch (_) {}
  };

  const wallMs = (mediaSec, rate = scene2Rate()) => Math.max(200, (mediaSec / rate) * 1000);

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const warmVideo = (video) => {
    if (!video) return Promise.resolve(video);
    if (warmed.has(video) && video.readyState >= 3) return Promise.resolve(video);
    return new Promise((resolve) => {
      const finish = () => { warmed.add(video); resolve(video); };
      if (video.readyState >= 3) return finish();
      video.preload = 'auto';
      const onReady = () => {
        if (video.readyState < 3) return;
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('canplaythrough', onReady);
        video.removeEventListener('loadeddata', onReady);
        finish();
      };
      video.addEventListener('canplay', onReady);
      video.addEventListener('canplaythrough', onReady);
      video.addEventListener('loadeddata', onReady);
      try { video.load(); } catch (_) {}
      window.setTimeout(finish, 5000);
    });
  };

  /** python http.server 等无 Range 源无法 mid-seek；拉成 blob 后舔爪 A-B 循环才可靠 */
  const ensureScene3Seekable = async () => {
    const video = videos.scene3;
    if (!video || video.__blobSeekable) return video;
    const src = video.getAttribute('src') || video.currentSrc;
    if (!src) return video;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      video.__blobSeekable = true;
      video.src = url;
      await new Promise((resolve) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener('loadedmetadata', resolve, { once: true });
        window.setTimeout(resolve, 4000);
      });
      warmed.delete(video);
    } catch (_) {
      /* 回退：仍用原 src，部分环境可 seek */
    }
    return video;
  };

  const seekReady = (video, time = 0) => new Promise((resolve) => {
    const done = () => { video.removeEventListener('seeked', done); resolve(video); };
    if (Math.abs((video.currentTime || 0) - time) < 0.04 && video.readyState >= 2) return resolve(video);
    video.addEventListener('seeked', done, { once: true });
    try { video.currentTime = time; } catch (_) { resolve(video); }
    window.setTimeout(done, 450);
  });

  const syncDurationsFrom = (video, key) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    if (key === 'transition') {
      transitionDuration = video.duration;
      setRootDuration();
    }
    if (key === 'scene2') scene2Duration = video.duration;
  };

  const readMetadata = async () => {
    await new Promise((resolve) => {
      const v = videos.scene1;
      if (Number.isFinite(v.duration) && v.duration > 0) return resolve();
      v.addEventListener('loadedmetadata', resolve, { once: true });
      window.setTimeout(resolve, 3000);
    });
    setRootDuration();
  };

  const clearInlineFade = (video) => {
    video.style.opacity = '';
    video.style.transition = '';
    video.style.zIndex = '';
    video.classList.remove('is-fading');
  };

  const showOnly = (visibleKeys) => {
    Object.entries(videos).forEach(([key, video]) => {
      const isVisible = visibleKeys.includes(key);
      if (!isVisible && key === 'scene1') video.style.opacity = '';
      video.classList.toggle('is-visible', isVisible);
      if (!isVisible) clearInlineFade(video);
    });
  };

  const safePlay = (video) => {
    if (video === videos.transition || video === videos.scene2 || video === videos.scene2Idle) {
      applyScene2Rate(video);
    }
    const promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  };

  const crossfadeTo = async (toKey, { fromKeys = null, startAt = 0 } = {}) => {
    const next = videos[toKey];
    if (!next) return;
    await warmVideo(next);
    await seekReady(next, startAt);
    const outgoing = fromKeys || Object.keys(videos).filter((k) => k !== toKey && videos[k].classList.contains('is-visible'));
    if (reduceMotion) {
      showOnly([toKey]);
      safePlay(next);
      pauseExcept([toKey]);
      return;
    }
    next.classList.add('is-visible', 'is-fading');
    next.style.visibility = 'visible';
    next.style.zIndex = '18';
    next.style.opacity = '0';
    next.style.transition = 'none';
    safePlay(next);
    await nextFrame();
    const fade = `opacity ${FADE_MS}ms linear`;
    next.style.transition = fade;
    next.style.opacity = '1';
    outgoing.forEach((key) => {
      const video = videos[key];
      if (!video || key === toKey) return;
      video.classList.add('is-fading');
      video.style.transition = fade;
      video.style.opacity = '0';
    });
    await new Promise((r) => window.setTimeout(r, FADE_MS + 30));
    showOnly([toKey]);
    pauseExcept([toKey]);
    clearInlineFade(next);
  };

  const runWhenVideoCompletes = (video, fallbackMs, callback) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('ended', finish);
      window.clearTimeout(timer);
      callback();
    };
    const timer = window.setTimeout(finish, fallbackMs);
    video.addEventListener('ended', finish, { once: true });
  };

  const clearScene3LickLoop = () => {
    const v = videos.scene3;
    if (!v) return;
    if (v.__lickTime) v.removeEventListener('timeupdate', v.__lickTime);
    if (v.__lickEnded) v.removeEventListener('ended', v.__lickEnded);
    v.__lickTime = null;
    v.__lickEnded = null;
    v.__lickSeeking = false;
    v.loop = false;
    try { v.playbackRate = 1; } catch (_) {}
  };

  /** 第三幕：跳出播完后再舔爪 A-B 循环 */
  const armScene3LickLoop = () => {
    const v = videos.scene3;
    if (!v) return;
    clearScene3LickLoop();
    v.loop = false;

    const applyPlayRate = () => {
      try { v.playbackRate = reduceMotion ? 1 : SCENE3_PLAY_RATE; } catch (_) {}
    };
    applyPlayRate();

    const wrapToLick = () => {
      if (v.__lickSeeking) return;
      if (phase !== 'scene3-idle' && phase !== 'transition-2-3') return;
      v.__lickSeeking = true;
      applyPlayRate();
      try {
        v.currentTime = SCENE3_LICK_START;
      } catch (_) {
        v.__lickSeeking = false;
        return;
      }
      const unlock = () => {
        v.__lickSeeking = false;
        v.removeEventListener('seeked', unlock);
      };
      v.addEventListener('seeked', unlock, { once: true });
      window.setTimeout(unlock, 180);
      if (v.paused) safePlay(v);
    };

    const onTime = () => {
      if (phase !== 'scene3-idle' && phase !== 'transition-2-3') return;
      if (v.__lickSeeking) return;
      applyPlayRate();
      if (v.currentTime >= SCENE3_LICK_END) wrapToLick();
    };
    const onEnded = () => { wrapToLick(); };

    v.__lickTime = onTime;
    v.__lickEnded = onEnded;
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
  };

  const pauseExcept = (activeKeys) => {
    Object.entries(videos).forEach(([key, video]) => {
      if (!activeKeys.includes(key)) {
        video.pause();
        if (!video.classList.contains('is-visible')) video.style.willChange = 'auto';
      } else {
        video.style.willChange = 'opacity';
      }
    });
  };

  const prefetchUpcoming = (fromPhase) => {
    if (fromPhase === 'scene1-idle') {
      warmVideo(videos.transition).then((v) => syncDurationsFrom(v, 'transition'));
    } else if (fromPhase === 'transition' || fromPhase === 'scene2-intro') {
      warmVideo(videos.scene2).then((v) => syncDurationsFrom(v, 'scene2'));
      warmVideo(videos.scene2Idle);
      ensureScene3Seekable().then(() => warmVideo(videos.scene3));
    } else if (fromPhase === 'scene2-idle') {
      ensureScene3Seekable().then(() => warmVideo(videos.scene3));
    }
  };

  const resetScene2Exit = ({ clearTimer = true } = {}) => {
    isScene2Leaving = false;
    if (clearTimer && scene2ExitTimer) {
      window.clearTimeout(scene2ExitTimer);
      scene2ExitTimer = null;
    }
    scene2Cards?.classList.remove('is-leaving');
  };

  const TRACK_X = {
    scene1: 'translate3d(0, 0, 0)',
    scene2: 'translate3d(-100vw, 0, 0)',
    scene3: 'translate3d(-200vw, 0, 0)'
  };
  let trackClearTimer = 0;

  const moveTrack = (scene, { ms = 0 } = {}) => {
    if (!contentTrack) return;
    const x = TRACK_X[scene] || TRACK_X.scene1;
    window.clearTimeout(trackClearTimer);
    const duration = (reduceMotion || ms <= 0) ? 0 : ms;
    if (duration === 0) {
      contentTrack.classList.remove('is-moving');
      contentTrack.style.transition = 'none';
      contentTrack.style.transform = x;
      void contentTrack.offsetWidth;
      contentTrack.style.transition = '';
      contentTrack.style.transform = '';
      return;
    }
    contentTrack.classList.add('is-moving');
    contentTrack.style.transition = `transform ${duration}ms var(--ease-silk)`;
    contentTrack.style.transform = x;
    trackClearTimer = window.setTimeout(() => {
      contentTrack.classList.remove('is-moving');
      contentTrack.style.transition = '';
      contentTrack.style.transform = '';
    }, duration + 40);
  };

  const revealLogin = () => {
    const card = document.querySelector('.login-card');
    if (!card) return;
    card.classList.remove('is-entering');
    void card.offsetWidth;
    if (reduceMotion || typeof gsap === 'undefined') {
      card.classList.add('is-entering');
      return;
    }
    const parts = card.querySelectorAll('h2, .login-lead, .login-tabs, .login-form label, .login-submit, .login-dev');
    gsap.set(card, { opacity: 1, x: 0 });
    gsap.fromTo(parts,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.82, stagger: 0.09, ease: 'power3.out', delay: 0.06 }
    );
  };

  const stopTypewriter = () => {
    if (typewriterTimer) {
      window.clearTimeout(typewriterTimer);
      typewriterTimer = 0;
    }
    if (typewriterTween) {
      typewriterTween.kill();
      typewriterTween = null;
    }
  };

  const finishTypewriter = (token) => {
    if (token !== typewriterToken) return;
    stopTypewriter();
    if (introTypewriter) introTypewriter.innerHTML = INTRO_HTML;
    introPanel?.classList.add('is-typed');
  };

  const typeByTimeout = (token) => {
    if (!introTypewriter) return;
    introTypewriter.textContent = '';
    let index = 0;
    const tick = () => {
      if (token !== typewriterToken) return;
      if (index >= INTRO_SCRIPT.length) {
        finishTypewriter(token);
        return;
      }
      introTypewriter.textContent = INTRO_SCRIPT.slice(0, index + 1);
      index += 1;
      const char = INTRO_SCRIPT[index - 1];
      const delay = char === '\n' ? 260 : (char === '。' || char === '；' ? 88 : 26);
      typewriterTimer = window.setTimeout(tick, delay);
    };
    typewriterTimer = window.setTimeout(tick, 40);
  };

  const startTypewriter = () => {
    stopTypewriter();
    typewriterToken += 1;
    const token = typewriterToken;
    introPanel?.classList.remove('is-typed');
    if (!introTypewriter) return;
    introTypewriter.textContent = '';
    if (reduceMotion) {
      finishTypewriter(token);
      return;
    }
    typewriterTimer = window.setTimeout(() => {
      if (token !== typewriterToken) return;
      if (typeof gsap !== 'undefined' && typeof TextPlugin !== 'undefined') {
        typewriterTween = gsap.to(introTypewriter, {
          duration: Math.max(2.6, INTRO_SCRIPT.replace(/\n/g, '').length * 0.046),
          text: { value: INTRO_HTML },
          ease: 'none',
          onComplete: () => finishTypewriter(token)
        });
        return;
      }
      typeByTimeout(token);
    }, 520);
  };

  const setPhase = (nextPhase, { trackMs } = {}) => {
    const prevPhase = phase;
    phase = nextPhase;
    document.body.dataset.phase = nextPhase.replace('-idle', '').replace('-intro', '');
    const label = {
      'scene1-idle': '首页',
      'transition': '过渡',
      'scene2-intro': '能力模块',
      'scene2-idle': '能力模块',
      'scene3-idle': '登录',
      'transition-2-3': '过渡'
    }[nextPhase] || nextPhase;
    stateText && (stateText.textContent = label);
    const scene = nextPhase.startsWith('scene2')
      ? 'scene2'
      : (nextPhase === 'transition-2-3' || nextPhase.startsWith('scene3')) ? 'scene3'
        : 'scene1';
    moveTrack(scene, { ms: trackMs ?? 0 });
    if (nextPhase.startsWith('scene2') || nextPhase === 'transition') {
      resetScene2Exit({ clearTimer: false });
    }
    if (nextPhase === 'scene2-intro' && prevPhase !== 'scene2-intro' && prevPhase !== 'scene2-idle') {
      startTypewriter();
    }
    if (nextPhase === 'scene3-idle') revealLogin();
    if (nextPhase === 'scene1-idle' || nextPhase.startsWith('scene2') || nextPhase === 'transition') {
      document.querySelector('.login-card')?.classList.remove('is-entering');
    }
  };

  const resetProgress = () => { if (progressBar) progressBar.style.transform = 'scaleX(0)'; };
  const setProgress = (pct) => {
    if (!progressBar) return;
    progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, pct / 100))})`;
  };

  const stopFrameLoop = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };

  const frameLoop = () => {
    rafId = 0;
    if (phase !== 'transition' && phase !== 'scene2-intro') return;
    if (phase === 'transition') {
      setProgress((videos.transition.currentTime / transitionDuration) * 100);
      if (!scene2CopyRevealed && videos.transition.currentTime >= SCENE2_COPY_AT) {
        scene2CopyRevealed = true;
        setPhase('scene2-intro', { trackMs: reduceMotion ? 0 : SCENE2_TRACK_MS });
      }
    }
    if (phase === 'scene2-intro') {
      const idleStart = Math.max(0, scene2Duration - 1.25);
      setProgress((videos.scene2.currentTime / scene2Duration) * 100);
      if (!scene2IdleStarted && videos.scene2.currentTime >= idleStart) {
        scene2IdleStarted = true;
        stopFrameLoop();
        crossfadeTo('scene2Idle', { fromKeys: ['scene2'], startAt: 0 }).then(() => {
          setPhase('scene2-idle');
          setProgress(100);
          isLocked = false;
          prefetchUpcoming('scene2-idle');
        });
        return;
      }
    }
    rafId = requestAnimationFrame(frameLoop);
  };

  const startFrameLoop = () => {
    if (!rafId) rafId = requestAnimationFrame(frameLoop);
  };

  const goScene2 = async () => {
    if (phase !== 'scene1-idle') return;
    const gen = ++moveGen;
    isLocked = true;
    scene2IdleStarted = false;
    scene2SkipStarted = false;
    scene2CopyRevealed = false;
    resetProgress();
    await warmVideo(videos.transition);
    if (gen !== moveGen) return;
    syncDurationsFrom(videos.transition, 'transition');
    prefetchUpcoming('transition');
    setPhase('transition', { trackMs: 0 });
    await crossfadeTo('transition', { fromKeys: ['scene1'], startAt: 0 });
    if (gen !== moveGen) return;
    isLocked = false;
    startFrameLoop();
    runWhenVideoCompletes(videos.transition, wallMs(transitionDuration) + 700, async () => {
      if (gen !== moveGen) return;
      await warmVideo(videos.scene2);
      if (gen !== moveGen) return;
      syncDurationsFrom(videos.scene2, 'scene2');
      applyScene2Rate(videos.scene2);
      await crossfadeTo('scene2', { fromKeys: ['transition'], startAt: 0 });
      if (gen !== moveGen) return;
      if (phase === 'transition') {
        scene2CopyRevealed = true;
        setPhase('scene2-intro', { trackMs: reduceMotion ? 0 : SCENE2_TRACK_MS });
      }
      isLocked = false;
      warmVideo(videos.scene2Idle).then(() => applyScene2Rate(videos.scene2Idle));
      startFrameLoop();
    });
  };

  const skipTransitionToScene2 = async () => {
    if (phase !== 'transition') return;
    const gen = ++moveGen;
    videos.transition.pause();
    stopFrameLoop();
    scene2IdleStarted = false;
    scene2CopyRevealed = true;
    setPhase('scene2-intro', { trackMs: reduceMotion ? 0 : 720 });
    isLocked = false;
    await warmVideo(videos.scene2);
    if (gen !== moveGen) return;
    syncDurationsFrom(videos.scene2, 'scene2');
    applyScene2Rate(videos.scene2);
    await crossfadeTo('scene2', { fromKeys: ['transition', 'scene1'], startAt: 0 });
    if (gen !== moveGen) return;
    if (phase !== 'scene2-intro' && phase !== 'scene2-idle') return;
    warmVideo(videos.scene2Idle).then(() => applyScene2Rate(videos.scene2Idle));
    startFrameLoop();
  };

  const goScene1 = ({ force = false } = {}) => {
    if (!force && phase === 'scene1-idle') return;
    const gen = ++moveGen;
    scene3Gen += 1;
    scene3JumpCleanup();
    scene3JumpCleanup = () => {};
    isLocked = true;
    scene2IdleStarted = true;
    scene2CopyRevealed = false;
    stopTypewriter();
    resetScene2Exit();
    stopFrameLoop();
    videos.transition.pause();
    videos.scene2.pause();
    videos.scene2Idle.pause();
    videos.scene3.pause();
    clearScene3LickLoop();
    setPhase('scene1-idle', { trackMs: 720 });
    crossfadeTo('scene1', {
      fromKeys: ['transition', 'scene2', 'scene2Idle', 'scene3'].filter((k) => videos[k].classList.contains('is-visible')),
      startAt: 0
    });
    setTimeout(() => {
      resetProgress();
      isLocked = false;
      scene2SkipStarted = false;
      window.dispatchEvent(new CustomEvent('scene:change', { detail: { scene: 1 } }));
    }, 760);
  };

  const goScene3 = ({ skipScene2Intro = false, fromScene2Exit = false, fromKey = null } = {}) => {
    const canEnterFromScene2Intro = skipScene2Intro && phase === 'scene2-intro';
    const allowFromScene1 = phase === 'scene1-idle' || phase === 'scene1';
    if (!fromKey && scene2SkipStarted) return;
    if (!fromKey && !canEnterFromScene2Intro && phase !== 'scene2-idle' && !allowFromScene1) return;
    if (canEnterFromScene2Intro) {
      scene2SkipStarted = true;
      scene2IdleStarted = true;
    }
    const gen = ++scene3Gen;
    isLocked = true;
    stopFrameLoop();
    ensureScene3Seekable().then(() => warmVideo(videos.scene3));
    setPhase('transition-2-3', { trackMs: reduceMotion ? 0 : 560 });
    const outgoingKey =
      fromKey ||
      (canEnterFromScene2Intro
        ? 'scene2'
        : allowFromScene1
          ? 'scene1'
          : videos.scene2Idle?.classList.contains('is-visible')
            ? 'scene2Idle'
            : 'scene1');
    const jumpStart = reduceMotion ? SCENE3_LICK_START : 0;
    const loginAt = reduceMotion ? 0.05 : SCENE3_LOGIN_AT;
    const loginWaitMs = reduceMotion ? 280 : wallMs(loginAt, SCENE3_PLAY_RATE);

    setTimeout(async () => {
      if (gen !== scene3Gen) return;
      await ensureScene3Seekable();
      if (gen !== scene3Gen) return;
      await warmVideo(videos.scene3);
      if (gen !== scene3Gen) return;
      await crossfadeTo('scene3', { fromKeys: [outgoingKey], startAt: jumpStart });
      if (gen !== scene3Gen) return;
      armScene3LickLoop();
      isLocked = false;

      const finishToLogin = () => {
        if (gen !== scene3Gen) return;
        if (phase !== 'transition-2-3') return;
        scene3JumpCleanup = () => {};
        showOnly(['scene3']);
        pauseExcept(['scene3']);
        setPhase('scene3-idle', { trackMs: reduceMotion ? 0 : 480 });
        isLocked = false;
        scene2SkipStarted = false;
        resetScene2Exit({ clearTimer: false });
        window.dispatchEvent(new CustomEvent('scene:change', { detail: { scene: 3 } }));
      };

      if (reduceMotion) {
        window.setTimeout(finishToLogin, 180);
        return;
      }

      const v = videos.scene3;
      const onJump = () => {
        if (v.currentTime >= loginAt - 0.04) {
          v.removeEventListener('timeupdate', onJump);
          finishToLogin();
        }
      };
      const failSafe = window.setTimeout(() => {
        v.removeEventListener('timeupdate', onJump);
        finishToLogin();
      }, loginWaitMs + 700);
      scene3JumpCleanup = () => {
        v.removeEventListener('timeupdate', onJump);
        window.clearTimeout(failSafe);
      };
      v.addEventListener('timeupdate', onJump);
    }, fromScene2Exit ? 0 : 40);
  };

  const skipScene3JumpToLogin = () => {
    if (phase !== 'transition-2-3') return;
    scene3Gen += 1;
    scene3JumpCleanup();
    scene3JumpCleanup = () => {};
    const v = videos.scene3;
    try { v.currentTime = SCENE3_LICK_START; } catch (_) {}
    armScene3LickLoop();
    showOnly(['scene3']);
    pauseExcept(['scene3']);
    setPhase('scene3-idle', { trackMs: 0 });
    isLocked = false;
    scene2SkipStarted = false;
    resetScene2Exit({ clearTimer: false });
    window.dispatchEvent(new CustomEvent('scene:change', { detail: { scene: 3 } }));
    if (v.paused) safePlay(v);
  };

  const startScene2ExitToScene3 = ({ skipScene2Intro = false } = {}) => {
    if (isScene2Leaving || scene2SkipStarted) return;
    if (phase !== 'scene2-idle' && phase !== 'scene2-intro') return;
    isScene2Leaving = true;
    isLocked = true;
    scene2Cards?.classList.add('is-leaving');
    const visibleScene2Key = phase === 'scene2-idle' ? 'scene2Idle' : 'scene2';
    showOnly([visibleScene2Key]);
    safePlay(videos[visibleScene2Key]);
    scene2ExitTimer = window.setTimeout(() => {
      scene2ExitTimer = null;
      const shouldSkipIntro = skipScene2Intro && phase === 'scene2-intro';
      if (!shouldSkipIntro) isLocked = false;
      if (phase === 'scene2-intro') setProgress(100);
      goScene3({ skipScene2Intro: shouldSkipIntro, fromScene2Exit: true });
    }, scene2ExitDelay);
  };

  const skipScene2AndGoScene3 = () => {
    if (scene2SkipStarted || isScene2Leaving) return;
    if (phase !== 'scene2-intro' && phase !== 'scene2-idle') return;
    startScene2ExitToScene3({ skipScene2Intro: phase === 'scene2-intro' });
  };

  const skipScene2AndGoScene1 = () => {
    if (phase !== 'scene2-intro' || scene2SkipStarted) return;
    scene2SkipStarted = true;
    videos.scene2.pause();
    goScene1({ force: true });
  };

  const goBackToScene2 = async () => {
    if (phase !== 'scene3-idle' && phase !== 'transition-2-3') return;
    scene3Gen += 1;
    scene3JumpCleanup();
    scene3JumpCleanup = () => {};
    isLocked = true;
    resetScene2Exit();
    clearScene3LickLoop();
    finishTypewriter(typewriterToken);
    setPhase('scene2-idle', { trackMs: 720 });
    await crossfadeTo('scene2Idle', { fromKeys: ['scene3'], startAt: 0 });
    applyScene2Rate(videos.scene2Idle);
    isLocked = false;
    window.dispatchEvent(new CustomEvent('scene:change', { detail: { scene: 2 } }));
  };

  const navigateSceneByDirection = (direction) => {
    if (document.body.classList.contains('project-detail-open')) return;
    if (isScene2Leaving) return;
    if (direction === 'next') {
      if (phase === 'scene1-idle') goScene2();
      else if (phase === 'transition') skipTransitionToScene2();
      else if (phase === 'scene2-intro') skipScene2AndGoScene3();
      else if (phase === 'scene2-idle') startScene2ExitToScene3();
      else if (phase === 'transition-2-3') skipScene3JumpToLogin();
      return;
    }
    if (phase === 'scene3-idle' || phase === 'transition-2-3') goBackToScene2();
    else if (phase === 'scene2-intro') skipScene2AndGoScene1();
    else if (phase === 'transition') goScene1({ force: true });
    else if (phase === 'scene2-idle') goScene1();
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (document.body.classList.contains('project-detail-open')) return;
    if (isScene2Leaving) return;
    const now = Date.now();
    if (now - lastWheelAt < 520) return;
    lastWheelAt = now;
    if (event.deltaY > 18) navigateSceneByDirection('next');
    if (event.deltaY < -18) navigateSceneByDirection('prev');
  };

  const handleAdvanceClick = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (document.body.classList.contains('project-detail-open')) return;
    if (isScene2Leaving) return;
    if (phase === 'scene3-idle') return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) return;
    const now = Date.now();
    if (now - lastAdvanceAt < 420) return;
    lastAdvanceAt = now;
    navigateSceneByDirection('next');
  };

  const handleTouchStart = (event) => {
    if (document.body.classList.contains('project-detail-open')) return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) return;
    isTouching = true;
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
  };

  const handleTouchMove = (event) => {
    if (!isTouching) return;
    if (event.touches.length !== 1) return;
    const deltaY = event.touches[0].clientY - touchStartY;
    const deltaX = event.touches[0].clientX - touchStartX;
    if (Math.abs(deltaY) >= Math.abs(deltaX)) event.preventDefault();
  };

  const handleTouchEnd = (event) => {
    if (!isTouching) return;
    isTouching = false;
    if (document.body.classList.contains('project-detail-open')) return;
    if (isScene2Leaving) return;
    const endY = event.changedTouches[0].clientY;
    const endX = event.changedTouches[0].clientX;
    const deltaY = touchStartY - endY;
    const deltaX = touchStartX - endX;
    if (Math.abs(deltaY) < TOUCH_THRESHOLD || Math.abs(deltaY) < Math.abs(deltaX)) return;
    const now = Date.now();
    if (now - lastTouchAt < TOUCH_THROTTLE_MS) return;
    lastTouchAt = now;
    navigateSceneByDirection(deltaY > 0 ? 'next' : 'prev');
  };

  const warmUpAutoplay = () => {
    Object.values(videos).forEach((video) => {
      video.muted = true;
      video.playsInline = true;
    });
    safePlay(videos.scene1);
    pauseExcept(['scene1']);
  };

  const resumeActiveAfterVisible = () => {
    if (phase === 'scene1-idle') safePlay(videos.scene1);
    else if (phase === 'transition') { safePlay(videos.transition); startFrameLoop(); }
    else if (phase === 'scene2-intro') { safePlay(videos.scene2); startFrameLoop(); }
    else if (phase === 'scene2-idle') safePlay(videos.scene2Idle);
    else if (phase === 'transition-2-3' || phase === 'scene3-idle') safePlay(videos.scene3);
  };

  window.addEventListener('wheel', handleWheel, { passive: false });
  siteShell?.addEventListener('click', handleAdvanceClick);
  siteShell?.addEventListener('touchstart', handleTouchStart, { passive: true });
  siteShell?.addEventListener('touchmove', handleTouchMove, { passive: false });
  siteShell?.addEventListener('touchend', handleTouchEnd, { passive: true });
  siteShell?.addEventListener('touchcancel', () => { isTouching = false; }, { passive: true });
  window.addEventListener('resize', updateAppHeight);
  window.visualViewport?.addEventListener('resize', updateAppHeight);
  window.visualViewport?.addEventListener('scroll', updateAppHeight);
  updateAppHeight();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      wasHidden = true;
      stopFrameLoop();
      Object.values(videos).forEach((v) => v.pause());
      return;
    }
    if (wasHidden) {
      wasHidden = false;
      resumeActiveAfterVisible();
    }
  });

  document.querySelectorAll('[data-go-login]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (phase === 'scene3-idle') return;
      if (phase === 'transition-2-3') {
        skipScene3JumpToLogin();
        return;
      }
      if (phase === 'scene2-intro' || phase === 'scene2-idle') {
        skipScene2AndGoScene3();
        return;
      }
      // 首页 / 其它阶段：直接进登录（演示友好）
      goScene3({ fromKey: 'scene1', fromScene2Exit: true });
    });
  });

  window.skipScene2AndGoScene3 = skipScene2AndGoScene3;
  window.goLoginFast = () => goScene3({ fromKey: 'scene1', fromScene2Exit: true });

  const loginForm = document.getElementById('entryLoginForm');
  const registerForm = document.getElementById('entryRegisterForm');
  const isLocalHost = () => {
    const host = location.hostname;
    return host === '127.0.0.1' || host === 'localhost';
  };
  const authApiBase = () => window.API_BASE || (isLocalHost() ? 'http://127.0.0.1:5000' : location.origin);

  const showAuthError = (el, message) => {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
  };

  const finishAuth = (payload) => {
    const data = payload && typeof payload === 'object' ? payload : {};
    // 保存 JWT（与 api.js 的 zhituGetToken 同一 key，Global Agent 等接口鉴权依赖它）
    if (data.token) {
      try { localStorage.setItem('zhitu_token', data.token); } catch (_) {}
    }
    localStorage.setItem('zhitu_user', JSON.stringify({
      username: data.username || 'user',
      role: data.role || 'user',
      loginTime: Date.now()
    }));
    const dest = 'pages/news/index.html';
    if (window.ZhituAuthTransit && window.ZhituAuthTransit.go) {
      window.ZhituAuthTransit.go(dest);
    } else {
      window.location.href = dest;
    }
  };

  const postAuth = async (path, body) => {
    const res = await fetch(authApiBase() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  };

  document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const name = tab.dataset.authTab;
      document.querySelectorAll('[data-auth-tab]').forEach((el) => {
        const on = el === tab;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      if (loginForm) loginForm.hidden = name !== 'login';
      if (registerForm) registerForm.hidden = name !== 'register';
    });
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('entryLoginError');
    const username = loginForm.querySelector('[name="username"]').value.trim();
    const password = loginForm.querySelector('[name="password"]').value;
    if (!username || !password) {
      showAuthError(errorEl, '请输入用户名和密码');
      return;
    }
    showAuthError(errorEl, '');
    try {
      const result = await postAuth('/api/auth/login', { username, password });
      if (result.code === 0) finishAuth(result.data);
      else showAuthError(errorEl, result.message || '登录失败，请先注册');
    } catch (_) {
      showAuthError(errorEl, '网络错误，请稍后重试');
    }
  });

  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('entryRegisterError');
    const username = registerForm.querySelector('[name="username"]').value.trim();
    const password = registerForm.querySelector('[name="password"]').value;
    const confirm = registerForm.querySelector('[name="confirm"]').value;
    if (!username || username.length < 3 || username.length > 20) {
      showAuthError(errorEl, '用户名长度应为3-20个字符');
      return;
    }
    if (!password || password.length < 6) {
      showAuthError(errorEl, '密码长度至少6位');
      return;
    }
    if (password !== confirm) {
      showAuthError(errorEl, '两次密码输入不一致');
      return;
    }
    showAuthError(errorEl, '');
    try {
      const registered = await postAuth('/api/auth/register', { username, password });
      if (registered.code !== 0) {
        showAuthError(errorEl, registered.message || '注册失败');
        return;
      }
      const loggedIn = await postAuth('/api/auth/login', { username, password });
      if (loggedIn.code === 0) finishAuth(loggedIn.data);
      else showAuthError(errorEl, '注册成功，请切换到登录');
    } catch (_) {
      showAuthError(errorEl, '网络错误，请稍后重试');
    }
  });

  const devSkip = document.getElementById('entryDevSkip');
  if (devSkip && isLocalHost()) {
    devSkip.hidden = false;
    devSkip.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const errorEl = document.getElementById('entryLoginError');
      showAuthError(errorEl, '');
      devSkip.disabled = true;
      try {
        // 本地跳过登录：确保 developer 账号存在并走真实后端签发 JWT
        let login = await postAuth('/api/auth/login', { username: 'developer', password: '123456' });
        if (login.code !== 0) {
          await postAuth('/api/auth/register', { username: 'developer', password: '123456' });
          login = await postAuth('/api/auth/login', { username: 'developer', password: '123456' });
        }
        if (login.code === 0) finishAuth(login.data);
        else showAuthError(errorEl, (login && login.message) || '开发账号不可用，请注册后登录');
      } catch (err) {
        showAuthError(
          errorEl,
          '连不上后端（' + authApiBase() + '）。请先运行 start_all.cmd 或确认 :5000 已启动。'
        );
        if (window.showToast) window.showToast('后端未就绪 · 请启动 :5000', 'amber');
      } finally {
        devSkip.disabled = false;
      }
    });
  }

  readMetadata().then(() => {
    document.body.dataset.phase = 'scene1';
    setPhase('scene1-idle');
    showOnly(['scene1']);
    warmUpAutoplay();
    const idlePrefetch = () => prefetchUpcoming('scene1-idle');
    if ('requestIdleCallback' in window) window.requestIdleCallback(idlePrefetch, { timeout: 2500 });
    else window.setTimeout(idlePrefetch, 1200);
  });
})();
