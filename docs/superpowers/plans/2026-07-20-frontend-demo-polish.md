# Frontend Demo Polish Implementation Plan

> **For agentic workers:** Implement task-by-task in `frontend/index.html`.

**Goal:** Elevate the 执图破局 SPA to competition-demo visual impact and harden view navigation.

**Architecture:** Single-file HTML overhaul — CSS token system, hero narrative, hash routing, deferred chart/G6 init.

**Tech Stack:** Vanilla HTML/CSS/JS, ECharts 5, AntV G6 5

## Global Constraints

- Scope: only `frontend/index.html` (plus this plan doc)
- Palette: ink `#0B1220`, signal teal `#2DD4BF`, amber `#F5A524`, page `#F7F8FC` — no purple-default look
- Fonts: Noto Serif SC (display), DM Sans + Noto Sans SC (body), IBM Plex Mono (data)
- Audience: 竞赛答辩 Demo — first viewport = brand + thesis + live graph + 2 CTAs

---

### Task 1: Tokens & typography
- [ ] Replace Google Fonts link and `:root` variables; map primary/gradients to teal system
- [ ] Add `prefers-reduced-motion` rules

### Task 2: Hero & dashboard narrative
- [ ] Restructure dash-hero HTML/CSS for brand-first composition
- [ ] Move KPI/stats below first impression; keep IDs for JS

### Task 3: Navigation hardening
- [ ] Hash routing + scrollTop + resize-after-visible for charts/G6
- [ ] Guard zero-size graph containers; soft-fail if G6 missing

### Task 4: Visual polish pass
- [ ] Sidebar, buttons, badges, chart accent colors align to new tokens
- [ ] Smoke-test all 10 views via hash

---
