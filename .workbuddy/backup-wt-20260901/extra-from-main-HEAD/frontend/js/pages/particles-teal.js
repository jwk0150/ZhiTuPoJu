(function () {
  var COUNT = 180;
  var LINK_DIST = 92;
  var PALETTE = ['#2DD4BF', '#0D9488', '#5EEAD4', '#99F6E4', '#14B8A6'];

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function mount(canvas, options) {
    options = options || {};
    if (!canvas || !canvas.getContext) return { destroy: function () {} };

    var stage = canvas.closest('.home-stage');
    if (prefersReducedMotion()) {
      if (stage) stage.classList.add('is-static');
      canvas.style.display = 'none';
      return { destroy: function () {} };
    }

    var ctx = canvas.getContext('2d');
    var particles = [];
    var raf = 0;
    var running = true;
    var dpr = 1;
    var width = 0;
    var height = 0;
    var count = options.count || COUNT;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      particles = [];
      var n = Math.max(120, Math.min(250, count));
      for (var i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.6 + 0.5,
          color: PALETTE[i % PALETTE.length],
          a: Math.random() * 0.45 + 0.25
        });
      }
    }

    function step() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);

      var i, j, p, q, dx, dy, dist;
      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      ctx.lineWidth = 0.6;
      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        var links = 0;
        for (j = i + 1; j < particles.length && links < 4; j++) {
          q = particles[j];
          dx = p.x - q.x;
          dy = p.y - q.y;
          dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            ctx.strokeStyle = 'rgba(45, 212, 191,' + (0.14 * (1 - dist / LINK_DIST)) + ')';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
            links++;
          }
        }
      }

      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      raf = window.requestAnimationFrame(step);
    }

    function onResize() {
      resize();
      seed();
    }

    resize();
    seed();
    raf = window.requestAnimationFrame(step);
    window.addEventListener('resize', onResize);

    return {
      destroy: function () {
        running = false;
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
      }
    };
  }

  window.TealParticles = { mount: mount, COUNT: COUNT };
})();
