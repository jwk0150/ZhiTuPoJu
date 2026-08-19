# -*- coding: utf-8 -*-
from pathlib import Path

portal = Path("frontend/portal.html").read_text(encoding="utf-8", errors="replace")

# --- runtime-core chart helpers + switchView ---
rc = Path("frontend/js/runtime-core.js")
text = rc.read_text(encoding="utf-8")
if "window.safeChart" not in text:
    s = portal.find("// ============== ECharts")
    e = portal.find("window.LiveUpdater", s)
    chunk = portal[s:e]
    stub = """
window.generateAllData = window.generateAllData || function () {
  window.Store.state = window.Store.state || {};
  window.Store.state.evolution = true;
  window.Store.state.jobs = window.Store.state.jobs || [];
};
window.viewNames = window.viewNames || {
  evolution: '岗位能力演化',
  learningPath: '学习路径',
  newSkill: '新增技能'
};
window.switchView = window.switchView || function (viewId) {
  var map = {
    evolution: 'view-evolution',
    learningPath: 'view-learningPath',
    newSkill: 'view-newSkill'
  };
  var target = map[viewId] || ('view-' + viewId);
  document.querySelectorAll('#page-main section.view').forEach(function (v) {
    v.classList.toggle('active', v.id === target);
  });
  if (viewId === 'learningPath' && window.initLearningPath) window.initLearningPath();
  if (viewId === 'newSkill' && window.initNewSkill) window.initNewSkill();
  if (viewId === 'evolution' && window.initEvolution) window.initEvolution();
};
"""
    rc.write_text(text.rstrip() + "\n\n" + chunk + "\n" + stub + "\n", encoding="utf-8")
    print("runtime-core patched")
else:
    print("runtime-core already has safeChart")

# --- evolution LP + NS ---
evo = Path("frontend/js/pages/evolution.js")
ej = evo.read_text(encoding="utf-8")
if "initLearningPath" not in ej:
    lp = portal[709261:716315]
    ns = portal[716365:724438]
    evo.write_text(ej.rstrip() + "\n\n" + lp + "\n" + ns + "\n", encoding="utf-8")
    print("evolution.js appended LP+NS", len(lp), len(ns))
else:
    print("evolution already has LP")

# --- evolution.html: only evolution active ---
eh = Path("frontend/pages/evolution.html")
html = eh.read_text(encoding="utf-8")
html2 = html.replace(
    '<section class="view active" id="view-learningPath">',
    '<section class="view" id="view-learningPath">',
).replace(
    '<section class="view active" id="view-newSkill">',
    '<section class="view" id="view-newSkill">',
)
eh.write_text(html2, encoding="utf-8")
print("evolution html active fixed", html != html2)

# --- discovery CDN ---
dh = Path("frontend/pages/discovery.html")
dhtml = dh.read_text(encoding="utf-8")
if "gsap" not in dhtml:
    needle = '<link rel="stylesheet" href="../css/legacy-views.css" />'
    inject = (
        needle
        + '\n  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>'
        + '\n  <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>'
    )
    if needle in dhtml:
        dhtml = dhtml.replace(needle, inject, 1)
        dh.write_text(dhtml, encoding="utf-8")
        print("discovery cdn added")
    else:
        print("discovery needle missing")
else:
    print("discovery already has gsap")

# hide LP/NS when wrongly all active via CSS already (.view {display:none})
print("done")
