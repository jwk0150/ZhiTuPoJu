### Task 4: Wire login + index + portal banner + hash routing

**Files:**
- Modify: `frontend/login.html` (redirect targets `pages/home.html`)
- Modify: `frontend/index.html` (redirect to `login.html` or `pages/home.html`)
- Modify: `frontend/portal.html` (legacy banner + hash → `switchView`)

**Interfaces:**
- Login success → `pages/home.html`
- `portal.html` on load: if `location.hash` is `#view-map` etc., call existing `window.switchView(id)`
- Banner HTML at top of `.app` or `body`: 「你正在使用旧版单页门户」+ link to `pages/home.html`

- [ ] **Step 1: In `login.html`, replace both `portal.html` redirects** with `pages/home.html`.

- [ ] **Step 2: Make `index.html` a short redirect:**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0; url=login.html" />
  <script>location.replace('login.html');</script>
  <title>执图破局</title>
</head>
<body><a href="login.html">进入登录</a></body>
</html>
```

(If current `index.html` is a full app duplicate of portal, replace carefully: move old content is NOT required — portal remains. Back up by `git` history.)

- [ ] **Step 3: Add portal banner** after `<body>` / `.app` open, and hash boot:

```javascript
(function bootHashView() {
  const h = (location.hash || '').replace(/^#view-/, '').replace(/^#/, '');
  if (h && typeof window.switchView === 'function') {
    window.switchView(h, { skipHash: true });
  }
  window.addEventListener('hashchange', () => {
    const id = (location.hash || '').replace(/^#view-/, '').replace(/^#/, '');
    if (id && window.switchView) window.switchView(id, { skipHash: true });
  });
})();
```

Place near existing `switchView` listeners after it is defined.

- [ ] **Step 4: Manual test**

1. `login.html` → after mock/real login lands on `pages/home.html`
2. From home click「数字人才地图」→ `portal.html#view-map` shows map view
3. Banner visible on portal

- [ ] **Step 5: Commit**

```bash
git add frontend/login.html frontend/index.html frontend/portal.html
git commit -m "feat(frontend): route login to new home and bridge portal hashes"
```

---
