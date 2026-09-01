/* 新岗位发现 · 收藏栏（本机 localStorage） */
(function () {
  const FAV_KEY = 'zhitu_disc_favs';
  const META_KEY = 'zhitu_disc_fav_meta';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function readMetaMap() {
    try {
      const raw = localStorage.getItem(META_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map && typeof map === 'object' ? map : {};
    } catch (_) {
      return {};
    }
  }

  function writeMetaMap(map) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function readFavs() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function writeFavs(list) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  function isFav(id) {
    return readFavs().indexOf(String(id)) >= 0;
  }

  function lookupJob(id) {
    const key = String(id);
    const meta = readMetaMap()[key];
    if (meta && meta.title) return meta;

    if (window.buildMockScanPayload) {
      const mock = window.buildMockScanPayload();
      const all = [...(mock.discoveries || []), ...(mock.forecasts || [])];
      const hit = all.find((j) => String(j.id) === key);
      if (hit) {
        return {
          id: hit.id,
          title: hit.title,
          lane: hit.is_forecast || hit.status === 'forecast' ? 'forecast' : 'found',
          conf: hit.confidence || hit.conf || 0
        };
      }
    }

    try {
      const raw = sessionStorage.getItem('zhitu_disc_job');
      if (raw) {
        const job = JSON.parse(raw);
        if (job && String(job.id) === key) {
          return {
            id: job.id,
            title: job.title,
            lane: job.isForecast || job.is_forecast || job.status === 'forecast' ? 'forecast' : 'found',
            conf: job.conf || job.confidence || 0
          };
        }
      }
    } catch (_) {}

    if (window.discoveryState) {
      const all = [
        ...(window.discoveryState.discoveries || []),
        ...(window.discoveryState.forecasts || [])
      ];
      const hit = all.find((j) => String(j.id) === key);
      if (hit) {
        return {
          id: hit.id,
          title: hit.title,
          lane: hit.is_forecast || hit.status === 'forecast' ? 'forecast' : 'found',
          conf: hit.confidence || hit.conf || 0
        };
      }
    }

    return meta || { id: key, title: '已收藏岗位', lane: 'found', conf: 0 };
  }

  function toggleFav(id, meta) {
    const key = String(id);
    let list = readFavs();
    const on = list.indexOf(key) >= 0;
    const map = readMetaMap();

    if (on) {
      list = list.filter((x) => x !== key);
      delete map[key];
    } else {
      list = list.concat(key);
      const snap = meta || lookupJob(key);
      map[key] = {
        id: key,
        title: snap.title || '已收藏岗位',
        lane: snap.lane === 'forecast' ? 'forecast' : 'found',
        conf: Number(snap.conf) || 0,
        savedAt: Date.now()
      };
    }

    writeFavs(list);
    writeMetaMap(map);
    notifyChange();
    return !on;
  }

  function removeFav(id) {
    const key = String(id);
    writeFavs(readFavs().filter((x) => x !== key));
    const map = readMetaMap();
    delete map[key];
    writeMetaMap(map);
    notifyChange();
  }

  function notifyChange() {
    window.dispatchEvent(new CustomEvent('discovery-favs-changed'));
  }

  function syncFavButtons(job) {
    const on = !!(job && job.id && isFav(job.id));
    ['dd-found-fav', 'dd-fc-fav'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.classList.toggle('is-on', on);
      const ico = btn.querySelector('.ico');
      if (ico) ico.textContent = on ? '★' : '☆';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderBar(root, options) {
    if (!root) return;
    const track = root.querySelector('.dd-fav-bar-track');
    if (!track) return;

    const ids = readFavs();
    const activeId =
      (options && options.activeId ? String(options.activeId) : '') ||
      root.dataset.activeId ||
      '';
    const countEl = root.querySelector('.dd-fav-bar-count');
    if (countEl) countEl.textContent = String(ids.length);

    if (!ids.length) {
      track.innerHTML =
        '<p class="dd-fav-bar-empty">暂无收藏。在岗位详情页点击「收藏」后，会显示在这里。</p>';
      root.classList.add('is-empty');
      return;
    }

    root.classList.remove('is-empty');
    track.innerHTML = ids
      .map((id) => {
        const job = lookupJob(id);
        const lane = job.lane === 'forecast' ? 'forecast' : 'found';
        const laneLabel = lane === 'forecast' ? '预测' : '真实';
        const activeCls = activeId && activeId === String(id) ? ' is-active' : '';
        const conf =
          job.conf != null && job.conf !== ''
            ? '<span class="conf">' + esc(String(job.conf)) + '%</span>'
            : '';
        return (
          '<div class="dd-fav-chip-wrap' +
          activeCls +
          '">' +
          '<a class="dd-fav-chip is-' +
          lane +
          '" href="discovery-detail.html?id=' +
          encodeURIComponent(id) +
          '" title="' +
          esc(job.title) +
          '">' +
          '<span class="lane">' +
          laneLabel +
          '</span>' +
          '<span class="title">' +
          esc(job.title) +
          '</span>' +
          conf +
          '</a>' +
          '<button type="button" class="dd-fav-chip-rm" data-fav-rm="' +
          esc(id) +
          '" aria-label="取消收藏 ' +
          esc(job.title) +
          '">×</button></div>'
        );
      })
      .join('');
  }

  function bindBar(root, options) {
    if (!root || root._favBound) return;
    root._favBound = true;

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fav-rm]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      removeFav(btn.getAttribute('data-fav-rm'));
    });

    window.addEventListener('discovery-favs-changed', () => {
      renderBar(root, options);
    });
  }

  function initBar() {
    /* 收藏栏已废弃：收藏直接进入个人仓库 */
    const root = document.getElementById('dd-fav-bar');
    if (root) {
      root.hidden = true;
      root.style.display = 'none';
    }
  }

  window.DiscoveryFavs = {
    readFavs,
    isFav,
    toggleFav,
    removeFav,
    lookupJob,
    syncFavButtons,
    renderBar,
    initBar
  };
})();
