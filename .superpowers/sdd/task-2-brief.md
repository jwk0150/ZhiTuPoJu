### Task 2: Add `api.js` + `shell.js`

**Files:**
- Create: `frontend/js/api.js`
- Create: `frontend/js/shell.js`

**Interfaces:**
- Produces:
  - `window.API_BASE: string` (default `http://127.0.0.1:5000`)
  - `window.apiFetch(path: string, options?: RequestInit): Promise<any>` — JSON helper, throws Error with message
  - `window.showToast(message: string, tone?: 'mint'|'amber'|'cyan'): void`
  - `window.Shell.mount({ pageId: string, title: string, subtitle: string }): void`
  - Nav items fixed in `shell.js` `NAV` constant matching spec §3.1–3.2
  - Undigested pages use `href` to `../portal.html#view-<id>` until Phase 1/2 migrates them
  - Demo path order: `map` → `evolution` → `discovery` → `match`

- [ ] **Step 1: Write `frontend/js/api.js`**

```javascript
(function () {
  window.API_BASE = window.API_BASE || 'http://127.0.0.1:5000';

  window.showToast = function (message, tone) {
    let el = document.getElementById('app-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'app-toast';
      el.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;padding:12px 16px;border-radius:10px;background:#0B1220;color:#fff;font:500 13px var(--font-body);box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.borderLeft = tone === 'amber' ? '3px solid #F59E0B' : '3px solid #2DD4BF';
    el.style.opacity = '1';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2800);
  };

  window.apiFetch = async function (path, options) {
    const url = path.startsWith('http') ? path : window.API_BASE + path;
    const res = await fetch(url, options);
    let payload = null;
    try { payload = await res.json(); } catch (_) { payload = null; }
    if (!res.ok) {
      const msg = (payload && (payload.detail || payload.message)) || ('HTTP ' + res.status);
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return payload;
  };
})();
```

- [ ] **Step 2: Write `frontend/js/shell.js`** implementing `NAV` (primary + more), `DEMO_STEPS`, `Shell.mount`:
  - Inject into `#app-shell`
  - Paths relative from `pages/` → use prefix `../` for css already in HTML; nav hrefs like `home.html`, `map.html`, or `../portal.html#view-map` for bridges
  - For Phase 0 bridge map: pages that do not exist yet point to portal hash
  - Read `localStorage.zhitu_user` if present for avatar label
  - Toggle「更多」open state in `sessionStorage.shell_more_open`

Bridge href map for Phase 0:

```javascript
const PAGE_HREF = {
  home: 'home.html',
  map: '../portal.html#view-map',
  evolution: '../portal.html#view-evolution',
  discovery: '../portal.html#view-discovery',
  match: '../portal.html#view-match',
  qa: '../portal.html#view-qa',
  collection: '../portal.html#view-collection',
  analysis: '../portal.html#view-analysis',
  quality: '../portal.html#view-quality',
  settings: '../portal.html#view-settings',
  profile: '../profile.html'
};
```

After a page is migrated in later tasks, change only that entry to `map.html` etc.

- [ ] **Step 3: Manual check** — open via http.server after Task 3; for now commit.

- [ ] **Step 4: Commit**

```bash
git add frontend/js/api.js frontend/js/shell.js
git commit -m "feat(frontend): add api helper and shared app shell"
```

---
