### Task 5: Archive root devtools scripts

**Files:**
- Create: `scripts/devtools/` (directory)
- Move: root `_*.py`, `_*.txt` matching diagnostic/acceptance patterns
- Create: `scripts/devtools/README.md` (one paragraph: archive of one-off checks)

**Interfaces:**
- Do **not** move: `run_backend.py`, `.env`, `zhoukou.yaml` (unless confirmed unused — keep yaml at root), `backend/`, `crawler/`, `docs/`, `论文/`
- Do not move files under `crawler/` or `backend/` that merely start with `_`

- [ ] **Step 1: List candidates**

```bash
# PowerShell from repo root
Get-ChildItem -File -Filter "_*" | Select-Object Name
```

- [ ] **Step 2: `mkdir scripts/devtools` and `git mv` each file**

```bash
mkdir -p scripts/devtools
git mv _check_http.py scripts/devtools/
# ... repeat for all root _* files
```

- [ ] **Step 3: Add `scripts/devtools/README.md`**

```markdown
# Devtools archive

One-off diagnostic / acceptance scripts and their log outputs formerly living at the repo root. Not part of the runtime app. Prefer `backend/` tests or documented check scripts for new work.
```

- [ ] **Step 4: `git status` — confirm root is clean of `_check_*` clutter**

- [ ] **Step 5: Commit**

```bash
git add scripts/devtools
git commit -m "chore: archive root diagnostic scripts under scripts/devtools"
```

---
