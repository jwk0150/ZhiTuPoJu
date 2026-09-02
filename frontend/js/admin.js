(function () {
  const refresh = document.getElementById('refreshBtn');
  if (refresh) refresh.addEventListener('click', function () {
    const original = refresh.textContent;
    refresh.textContent = '✓ 已刷新';
    refresh.disabled = true;
    setTimeout(function () { refresh.textContent = original; refresh.disabled = false; }, 1400);
  });
  const links = Array.from(document.querySelectorAll('.admin-nav a'));
  const sections = links.map(function (link) { return document.querySelector(link.getAttribute('href')); }).filter(Boolean);
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      links.forEach(function (link) { link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id); });
    });
  }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
  sections.forEach(function (section) { observer.observe(section); });
})();
