# -*- coding: utf-8 -*-
from pathlib import Path

css_path = Path("frontend/css/legacy-views.css")
ability = Path("scripts/devtools/_ability_css_port.css").read_text(encoding="utf-8").strip()
text = css_path.read_text(encoding="utf-8")
if ".ability-modal-mask{" in text:
    print("already has ability css")
else:
    extra = (
        "\n\n/* ===== 我的能力弹窗（自 ls_new1 移植，Soft Ink Gold 适配） ===== */\n"
        + ability
        + "\n\n"
        + """/* ===== 岗位知识图谱：墨金风格（覆盖蓝紫/青绿旧色） ===== */
body[data-page="map"] .graph-city-label{color:#e4cfa0;font-size:14px;font-weight:650;letter-spacing:.4px;text-shadow:0 1px 8px rgba(0,0,0,.35)}
body[data-page="map"] .graph-mode-bubble{
  font-size:12.5px;font-weight:600;letter-spacing:.4px;padding:6px 16px;border-radius:999px;
  border:1px solid rgba(201,168,106,.32);background:rgba(201,168,106,.1);color:rgba(228,207,160,.88);
  cursor:pointer;transition:background .2s,border-color .2s,color .2s,transform .2s;white-space:nowrap;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)
}
body[data-page="map"] .graph-mode-bubble:hover{background:rgba(201,168,106,.18);border-color:rgba(201,168,106,.55);color:#f0e2c0;transform:translateY(-1px)}
body[data-page="map"] .graph-mode-bubble.active{
  background:rgba(201,168,106,.28);border-color:rgba(201,168,106,.75);color:#fff8e8;
  box-shadow:0 0 14px rgba(201,168,106,.28),inset 0 0 10px rgba(228,207,160,.08)
}
body[data-page="map"] .tech-node-tooltip{
  background:rgba(16,28,25,.96)!important;border:1px solid rgba(201,168,106,.4)!important;color:#e8eee9!important;
  box-shadow:0 6px 22px rgba(0,0,0,.45),0 0 16px rgba(201,168,106,.16)!important
}
body[data-page="map"] #talent-detail-province .graph-btn{
  color:#e4cfa0;background:rgba(201,168,106,.1);border-color:rgba(201,168,106,.32);
  width:auto;height:auto;padding:6px 12px;font-size:13px
}
body[data-page="map"] #talent-detail-province .graph-btn:hover{background:rgba(201,168,106,.2);border-color:#c9a86a}
"""
    )
    css_path.write_text(text.rstrip() + "\n" + extra + "\n", encoding="utf-8")
    print("appended", len(extra), "chars")
