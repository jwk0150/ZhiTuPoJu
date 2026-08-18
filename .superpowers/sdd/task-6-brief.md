### Task 6: Phase 0 acceptance checklist

**Files:** none (verification only) or update spec status line to「已批准 / Phase0 完成」

- [ ] **Step 1: Run frontend + backend**

```bash
python run_backend.py
cd frontend && python -m http.server 8080
```

- [ ] **Step 2: Checklist**

| Check | Expected |
|-------|----------|
| `/pages/home.html` | Shell + 4 journey steps |
| Sidebar「更多」 | Toggles collection/analysis/quality/settings bridges |
| Demo path next | Advances highlight; link works |
| Login redirect | `pages/home.html` |
| Portal banner | Visible |
| `#view-match` | Opens match view |
| Root `_check_*.py` | Gone (in `scripts/devtools/`) |

- [ ] **Step 3: Commit spec status tweak if any**

```bash
git commit -m "docs: mark frontend IA Phase 0 acceptance"
```

---

## ADDENDUM
Also:
1. Append one line to scripts/devtools/README.md noting archived scripts may assume repo-root __file__ and are read-only artifacts.
2. Update docs/superpowers/specs/2026-08-15-frontend-ia-multipage-design.md status to note Phase 0 complete if checks pass.
3. Prefer HTTP smoke (Invoke-WebRequest / curl) for home.html, login.html, portal.html banner string, and /api/health if backend up. Headed browser optional.
4. Record checklist results in the report.

