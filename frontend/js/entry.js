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
  const enterBtn = document.getElementById('enterBtn');
  const progressBar = document.getElementById('progressBar');
  const stateText = document.getElementById('stateText');
  const navDots = [...document.querySelectorAll('.nav-dot')];
  const mobilePrevBtn = document.querySelector('[data-mobile-prev]');
  const mobileNextBtn = document.querySelector('[data-mobile-next]');
  const scene2Cards = document.querySelector('.project-cards-grid');

  let phase = 'scene1-idle';
  let isLocked = false;
  let transitionDuration = 8.833;
  let scene2Duration = 8.767;
  let scene2IdleStarted = false;
  let lastWheelAt = 0;
  let touchStartY = 0;
  let touchStartX = 0;
  let isTouching = false;
  let lastTouchAt = 0;
  let scene2SkipStarted = false;
  let isScene2Leaving = false;
  let scene2ExitTimer = null;
  const scene2ExitDelay = 320;
  const TOUCH_THRESHOLD = 60;
  const TOUCH_THROTTLE_MS = 680;
  const INTERACTIVE_TOUCH_SELECTOR = 'button, a, input, textarea, select, label, .project-modal-card, .mobile-scene-controls';

  const updateAppHeight = () => {
    const height = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
  };

  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

  const setRootDuration = () => {
    const ms = Math.max(1200, transitionDuration * 1000);
    document.documentElement.style.setProperty('--transition-ms', `${ms}ms`);
  };

  const readMetadata = async () => {
    await Promise.all(Object.values(videos).map(video => new Promise(resolve => {
      if (Number.isFinite(video.duration) && video.duration > 0) return resolve();
      video.addEventListener('loadedmetadata', resolve, { once: true });
    })));

    if (Number.isFinite(videos.transition.duration)) transitionDuration = videos.transition.duration;
    if (Number.isFinite(videos.scene2.duration)) scene2Duration = videos.scene2.duration;
    setRootDuration();
  };

  const showOnly = (visibleKeys) => {
    Object.entries(videos).forEach(([key, video]) => {
      const isVisible = visibleKeys.includes(key);
      if (!isVisible && key === 'scene1') video.style.opacity = '';
      video.classList.toggle('is-visible', isVisible);
    });
  };

  const safePlay = (video) => {
    const promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
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

  const pauseExcept = (activeKeys) => {
    Object.entries(videos).forEach(([key, video]) => {
      if (!activeKeys.includes(key)) video.pause();
    });
  };

  const resetScene2Exit = ({ clearTimer = true } = {}) => {
    isScene2Leaving = false;
    if (clearTimer && scene2ExitTimer) {
      window.clearTimeout(scene2ExitTimer);
      scene2ExitTimer = null;
    }
    scene2Cards?.classList.remove('is-leaving');
  };

  const updateDots = (active) => {
    navDots.forEach(dot => {
      const dotScene = dot.dataset.scene || dot.dataset.go;
      const isActive =
        (dotScene === 'scene1' && active === 'scene1') ||
        (dotScene === 'scene2' && active === 'scene2') ||
        (dotScene === 'scene3' && active === 'scene3');
      dot.classList.toggle('is-active', isActive);
    });
  };

  const setPhase = (nextPhase) => {
    phase = nextPhase;
    document.body.dataset.phase = nextPhase.replace('-idle', '').replace('-intro', '');

    const label = {
      'scene1-idle': '项目首页 · Project',
      'transition': 'Transition 01 → 02',
      'scene2-intro': '项目介绍 · Project Intro',
      'scene2-idle': '项目介绍 · Project Intro',
      'scene3-idle': 'Scene 03 · Login',
      'transition-2-3': 'Transition 02 → 03'
    }[nextPhase] || nextPhase;

    stateText.textContent = label;

    if (nextPhase.startsWith('scene3') || nextPhase === 'transition-2-3') updateDots('scene3');
    else if (nextPhase.startsWith('scene2')) updateDots('scene2');
    else updateDots('scene1');
  };

  const resetProgress = () => {
    progressBar.style.width = '0%';
  };

  const frameLoop = () => {
    if (phase === 'transition') {
      const pct = Math.min(100, (videos.transition.currentTime / transitionDuration) * 100);
      progressBar.style.width = `${pct}%`;
    }

    if (phase === 'scene2-intro') {
      const idleStart = Math.max(0, scene2Duration - 1.02);
      const pct = Math.min(100, (videos.scene2.currentTime / scene2Duration) * 100);
      progressBar.style.width = `${pct}%`;

      if (!scene2IdleStarted && videos.scene2.currentTime >= idleStart) {
        scene2IdleStarted = true;
        videos.scene2Idle.currentTime = 0;
        safePlay(videos.scene2Idle);
        showOnly(['scene2Idle']);
        setPhase('scene2-idle');
        pauseExcept(['scene2Idle']);
        progressBar.style.width = '100%';
        isLocked = false;
      }
    }

    requestAnimationFrame(frameLoop);
  };

  const goScene2 = async () => {
    if (isLocked || phase !== 'scene1-idle') return;
    isLocked = true;
    scene2IdleStarted = false;
    scene2SkipStarted = false;
    resetProgress();

    videos.scene1.style.opacity = '';
    contentTrack.classList.add('is-moving');
    setPhase('transition');
    showOnly(['transition']);
    pauseExcept(['transition']);

    videos.transition.currentTime = 0;
    safePlay(videos.transition);

    runWhenVideoCompletes(videos.transition, (transitionDuration * 1000) + 700, () => {
      videos.scene2.style.transition = '';
      videos.scene2.style.opacity = '1';
      showOnly(['scene2']);
      pauseExcept(['scene2']);

      videos.scene2.currentTime = 0;
      setPhase('scene2-intro');
      safePlay(videos.scene2);
    });
  };

  const goScene1 = ({ force = false } = {}) => {
    if (!force && (isLocked || phase === 'transition')) return;
    isLocked = true;
    scene2IdleStarted = true;
    resetScene2Exit();

    contentTrack.classList.add('is-moving');
    contentTrack.style.transition = 'transform 520ms var(--ease-cinema)';
    contentTrack.style.transform = 'translate3d(0,0,0)';

    videos.transition.pause();
    videos.scene2.pause();
    videos.scene2Idle.pause();
    videos.transition.currentTime = 0;
    videos.scene2.currentTime = 0;
    videos.scene2Idle.currentTime = 0;
    videos.transition.style.opacity = '0';
    videos.scene2.style.opacity = '0';
    videos.scene2Idle.style.opacity = '0';
    videos.scene2.style.transition = '';
    videos.scene2Idle.style.transition = '';
    videos.scene1.style.opacity = '1';
    showOnly(['scene1']);
    pauseExcept(['scene1']);
    videos.scene1.currentTime = 0;
    safePlay(videos.scene1);

    document.body.dataset.phase = 'scene1';
    setTimeout(() => {
      contentTrack.classList.remove('is-moving');
      contentTrack.style.transition = '';
      contentTrack.style.transform = '';
      videos.transition.style.opacity = '';
      videos.scene2.style.opacity = '';
      videos.scene2Idle.style.opacity = '';
      videos.scene1.style.opacity = '';
      setPhase('scene1-idle');
      resetProgress();
      isLocked = false;
      scene2SkipStarted = false;
      window.dispatchEvent(new CustomEvent('scene:change', { detail: { scene: 1 } }));
    }, 560);
  };

  const goScene3 = ({ skipScene2Intro = false, fromScene2Exit = false } = {}) => {
    const canEnterFromScene2Intro = skipScene2Intro && phase === 'scene2-intro';
    if (scene2SkipStarted || (!canEnterFromScene2Intro && (isLocked || phase !== 'scene2-idle'))) return;

    if (canEnterFromScene2Intro) {
      scene2SkipStarted = true;
      scene2IdleStarted = true;
    }

    isLocked = true;
    contentTrack.classList.add('is-moving');
    contentTrack.style.transform = 'translateX(-100vw)';
    setPhase('transition-2-3');

    const outgoingKey = canEnterFromScene2Intro ? 'scene2' : 'scene2Idle';
    videos[outgoingKey].style.transition = '';
    videos[outgoingKey].style.opacity = '1';

    setTimeout(async () => {
      showOnly([outgoingKey]);

      // 淡入登录背景视频
      videos.scene3.currentTime = 0;
      videos.scene3.style.transition = 'opacity 0.8s ease';
      showOnly([outgoingKey, 'scene3']);
      safePlay(videos.scene3);
      requestAnimationFrame(() => { videos.scene3.style.opacity = '1'; });

      contentTrack.style.transition = `transform ${transitionDuration * 1000}ms var(--ease-cinema)`;
      contentTrack.style.transform = 'translateX(-200vw)';

      setTimeout(() => {
        setPhase('scene3-idle');
        isLocked = false;
        scene2SkipStarted = false;
        resetScene2Exit({ clearTimer: false });
        window.dispatchEvent(new CustomEvent('scene:change', { detail: { scene: 3 } }));
      }, transitionDuration * 1000);
    }, fromScene2Exit ? 0 : (canEnterFromScene2Intro ? 120 : 800));
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
      if (phase === 'scene2-intro') progressBar.style.width = '100%';
      goScene3({ skipScene2Intro: shouldSkipIntro, fromScene2Exit: true });
    }, scene2ExitDelay);
  };

  const skipScene2AndGoScene3 = () => {
    if (phase !== 'scene2-intro' || scene2SkipStarted) return;
    startScene2ExitToScene3({ skipScene2Intro: true });
  };

  const skipScene2AndGoScene1 = () => {
    if (phase !== 'scene2-intro' || scene2SkipStarted) return;
    scene2SkipStarted = true;
    videos.scene2.pause();
    goScene1({ force: true });
  };

  const goBackToScene2 = () => {
    if (isLocked || phase !== 'scene3-idle') return;
    isLocked = true;
    resetScene2Exit();

    videos.scene3.style.transition = 'opacity 0.8s ease';
    videos.scene3.style.opacity = '0';

    setTimeout(() => {
      videos.scene3.pause();
      videos.scene3.currentTime = 0;

      showOnly(['scene2Idle']);
      videos.scene2Idle.style.display = 'block';
      videos.scene2Idle.style.opacity = '0';
      videos.scene2Idle.currentTime = 0;
      safePlay(videos.scene2Idle);

      requestAnimationFrame(() => {
        videos.scene2Idle.style.transition = 'opacity 0.8s ease';
        videos.scene2Idle.style.opacity = '1';
      });

      contentTrack.style.transition = `transform ${transitionDuration * 1000}ms var(--ease-cinema)`;
      contentTrack.style.transform = 'translateX(-100vw)';

      setTimeout(() => {
        setPhase('scene2-idle');
        isLocked = false;
        window.dispatchEvent(new CustomEvent('scene:change', { detail: { scene: 2 } }));
      }, transitionDuration * 1000);
    }, 800);
  };

  const navigateSceneByDirection = (direction) => {
    if (document.body.classList.contains('project-detail-open')) return;
    if (isScene2Leaving) return;

    if (direction === 'next') {
      if (phase === 'scene1-idle') goScene2();
      else if (phase === 'scene2-intro') skipScene2AndGoScene3();
      else if (phase === 'scene2-idle') startScene2ExitToScene3();
      return;
    }

    if (phase === 'scene3-idle') goBackToScene2();
    else if (phase === 'scene2-intro') skipScene2AndGoScene1();
    else if (phase === 'scene2-idle') goScene1();
  };

  const handleWheel = (event) => {
    event.preventDefault();
    if (document.body.classList.contains('project-detail-open')) return;
    if (isScene2Leaving) return;

    if (phase === 'scene2-intro' && Math.abs(event.deltaY) > 18) {
      if (event.deltaY > 0) skipScene2AndGoScene3();
      else skipScene2AndGoScene1();
      return;
    }

    const now = Date.now();
    if (now - lastWheelAt < 700) return;
    lastWheelAt = now;

    if (event.deltaY > 18) {
      if (phase === 'scene1-idle') goScene2();
      else if (phase === 'scene2-idle') startScene2ExitToScene3();
    }
    if (event.deltaY < -18) {
      if (phase === 'scene2-idle' || phase === 'scene2-intro') goScene1();
      else if (phase === 'scene3-idle') goBackToScene2();
    }
  };

  const handleTouchStart = (event) => {
    if (!isMobileViewport()) return;
    if (document.body.classList.contains('project-detail-open')) return;
    if (event.target.closest(INTERACTIVE_TOUCH_SELECTOR)) return;

    isTouching = true;
    touchStartY = event.touches[0].clientY;
    touchStartX = event.touches[0].clientX;
  };

  const handleTouchMove = (event) => {
    if (!isMobileViewport()) return;
    if (!isTouching) return;
    if (event.touches.length !== 1) return;

    const deltaY = event.touches[0].clientY - touchStartY;
    const deltaX = event.touches[0].clientX - touchStartX;

    if (Math.abs(deltaY) >= Math.abs(deltaX)) event.preventDefault();
  };

  const handleTouchEnd = (event) => {
    if (!isMobileViewport()) return;
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
    Object.values(videos).forEach(video => {
      video.muted = true;
      video.playsInline = true;
    });
    safePlay(videos.scene1);
    if (videos.scene3) {
      videos.scene3.currentTime = 0;
      videos.scene3.pause();
    }
  };

  enterBtn.addEventListener('click', goScene2);
  window.addEventListener('wheel', handleWheel, { passive: false });
  siteShell?.addEventListener('touchstart', handleTouchStart, { passive: true });
  siteShell?.addEventListener('touchmove', handleTouchMove, { passive: false });
  siteShell?.addEventListener('touchend', handleTouchEnd, { passive: true });
  siteShell?.addEventListener('touchcancel', () => { isTouching = false; }, { passive: true });
  window.addEventListener('resize', updateAppHeight);
  window.visualViewport?.addEventListener('resize', updateAppHeight);
  window.visualViewport?.addEventListener('scroll', updateAppHeight);
  updateAppHeight();

  mobilePrevBtn?.addEventListener('click', () => navigateSceneByDirection('prev'));
  mobileNextBtn?.addEventListener('click', () => navigateSceneByDirection('next'));

  document.querySelector('[data-go="scene1"]')?.addEventListener('click', goScene1);
  document.querySelector('[data-go="scene2"]')?.addEventListener('click', goScene2);
  document.querySelector('[data-go="scene3"]')?.addEventListener('click', () => {
    if (phase === 'scene2-idle') startScene2ExitToScene3();
    else if (phase === 'scene2-intro') skipScene2AndGoScene3();
  });

  // 登录：仅跳转，不做真实验证
  const loginForm = document.getElementById('entryLoginForm');
  loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = loginForm.querySelector('[name="username"]').value.trim() || '访客';
    localStorage.setItem('zhitu_user', JSON.stringify({
      username, role: 'user', loginTime: Date.now()
    }));
    window.location.href = 'pages/home.html';
  });

  readMetadata().then(() => {
    document.body.dataset.phase = 'scene1';
    setPhase('scene1-idle');
    showOnly(['scene1']);
    warmUpAutoplay();
    frameLoop();
  });
})();
