<<<<<<< HEAD
## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-discovery-mission-control-design.md`
- Scope: only `view-discovery` UI + discovery backend DeepSeek layer; do not redesign other views
- Palette: ink `#0B1220`, signal `#2DD4BF` / `#0D9488`, amber `#F5A524` — no purple-default look
- Secrets: `DEEPSEEK_API_KEY` via env / `.env` only — never hardcode keys in source or commit `.env`
- PG: `127.0.0.1:3309` / `zhilian_crawl_db` / tables `zhilian_job_postings` + `zhilian_job_posting_details`
- Scan response must keep keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`
- `prefers-reduced-motion`: disable particles, typewriter, heavy GSAP; steps snap in
- Commits: only when the user explicitly asks (do not auto-commit)


### Task 4: Mission-control CSS

**Files:**
- Modify: `frontend/index.html` `<style>` — add `.disc-*` block near other view styles

- [ ] **Step 1: Add CSS** covering:

```css
.disc-mission{display:grid;grid-template-columns:42% 58%;gap:16px;min-height:calc(100vh - 180px);align-items:stretch}
.disc-left{position:relative;background:linear-gradient(165deg,#0B1220 0%,#0f1a24 55%,#0a1f1c 100%);border-radius:16px;overflow:hidden;color:#E2E8F0;border:1px solid rgba(45,212,191,.2)}
.disc-particles,.disc-cluster-canvas{position:absolute;inset:0;pointer-events:none}
.disc-cluster-canvas{z-index:1;opacity:.55}
.disc-left-inner{position:relative;z-index:2;padding:18px 16px 20px;display:flex;flex-direction:column;gap:12px;height:100%}
.disc-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;overflow:auto;max-height:42%}
.disc-step{padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);font-size:12px;opacity:.45;transition:opacity .3s,border-color .3s}
.disc-step.active,.disc-step.done{opacity:1}
.disc-step.active{border-color:rgba(45,212,191,.55);box-shadow:0 0 0 1px rgba(45,212,191,.2)}
.disc-step.done{border-color:rgba(16,185,129,.35)}
.disc-right{display:flex;flex-direction:column;gap:12px;min-width:0}
.disc-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.disc-kpi{background:#fff;border:1px solid var(--border-dark);border-radius:12px;padding:12px;text-align:left;cursor:pointer}
.disc-kpi span{font-family:var(--font-mono);font-size:22px;font-weight:600;color:var(--ink);display:block}
.job-card.is-forecast{border:1px solid rgba(245,165,36,.45);box-shadow:inset 3px 0 0 var(--signal)}
.disc-drawer{position:fixed;top:0;right:0;width:min(420px,100vw);height:100vh;background:#fff;z-index:120;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-16px 0 48px rgba(11,18,32,.18)}
.disc-drawer.open{transform:translateX(0)}
.disc-drawer-mask{position:fixed;inset:0;background:rgba(11,18,32,.45);z-index:110;opacity:0;pointer-events:none;transition:opacity .25s}
.disc-drawer-mask.open{opacity:1;pointer-events:auto}
.disc-hallucination{min-height:72px;border:1px dashed rgba(245,165,36,.4);border-radius:10px;padding:10px;font-size:11px;font-family:var(--font-mono)}
.disc-claim{opacity:.35;filter:blur(1px);transition:all .4s}
.disc-claim.verified{opacity:1;filter:none;color:var(--signal)}
.disc-claim.warn{opacity:1;filter:none;color:var(--amber)}
@media (max-width:1100px){.disc-mission{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){
  .disc-drawer{transition:none}
  .disc-particles{display:none!important}
}
```

Remove reliance on old `#agent-panel` card (deleted with HTML replace).

- [ ] **Step 2: Visual check** — left pane reads as ink command deck; right is light workbench; no purple forecast styling.
=======
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
>>>>>>> ebfe0503a88e347cada72195ca5a2fad8c551338

---
