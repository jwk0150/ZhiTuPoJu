## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-discovery-mission-control-design.md`
- Scope: only `view-discovery` UI + discovery backend DeepSeek layer; do not redesign other views
- Palette: ink `#0B1220`, signal `#2DD4BF` / `#0D9488`, amber `#F5A524` — no purple-default look
- Secrets: `DEEPSEEK_API_KEY` via env / `.env` only — never hardcode keys in source or commit `.env`
- PG: `127.0.0.1:3309` / `zhilian_crawl_db` / tables `zhilian_job_postings` + `zhilian_job_posting_details`
- Scan response must keep keys: `reasoning_chain`, `discoveries`, `forecasts`, `summary`, `stats`, `model`
- `prefers-reduced-motion`: disable particles, typewriter, heavy GSAP; steps snap in
- Commits: only when the user explicitly asks (do not auto-commit)


### Task 8: End-to-end verification

**Files:** none (manual + optional curl)

- [ ] **Step 1: Backend health**

```bash
curl http://127.0.0.1:8000/api/health
curl -X POST http://127.0.0.1:8000/api/discovery/agent/scan
```

Confirm discoveries reference real-looking titles from PG (e.g. contain AI/Agent/运维等真实库方向).

- [ ] **Step 2: Frontend demo path**

1. Open `frontend/index.html` (or served static)
2. Navigate 新岗位发现
3. Idle → dual pane
4. Start scan → 6-step playback + FX
5. Cards appear; open drawer; adopt one; switch 未来预测 tab
6. Kill backend, rescan → mock fallback toast + still usable

- [ ] **Step 3: Security check**

```bash
rg "sk-[a-zA-Z0-9]" backend frontend --glob '!.env'
```

Expected: no real API key matches in tracked files.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| Dual-pane 42/58 mission control | 3, 4 |
| Idle / Scanning / Settled | 5 |
| 6-step reasoning + FX + hallucination climax | 5, 6 |
| Real PG data | 2 (existing agent) |
| DeepSeek enrich Top-N | 1, 2 |
| Key via env only | 1, 8 |
| Workbench + drawer + batch adopt | 7 |
| Mock / CDN / reduced-motion degrade | 5, 6 |
| No purple default / teal-amber forecast | 4, 7 |

## Self-Review Notes

- No TBD placeholders in tasks
- Response schema names match existing `discovery.py`
- Drawer replaces broken `modal.classList.add('open')` path for discovery details
- DeepSeek failure never fails the whole scan
