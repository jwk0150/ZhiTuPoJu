# -*- coding: utf-8 -*-
"""Apply map graph / ability / tech-detail CSS fixes (append if missing)."""
from pathlib import Path

CSS_PATH = Path("frontend/css/legacy-views.css")
BLOCK = r"""

/* ===== FIX 20260825c: graph overlap + ability height + tech-detail contrast ===== */
#talent-map-canvas.is-graph-view #talent-back-zone{
  max-width:52px;
}
#talent-layer-graph .graph-toolbar{
  left:68px !important;
  top:14px !important;
  right:16px !important;
}
#talent-layer-graph .graph-city-label{
  flex:0 1 auto;
  max-width:min(260px,34vw);
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  padding:6px 14px;
  border-radius:999px;
  border:1px solid rgba(201,168,106,.35);
  background:rgba(16,28,25,.62);
  color:#e8d9b0 !important;
  font-size:13px;
  font-weight:650;
  letter-spacing:.3px;
}
#talent-layer-graph .graph-mode-bubble{
  font-size:12.5px;font-weight:650;letter-spacing:.3px;padding:6px 16px;border-radius:999px;
  border:1px solid rgba(201,168,106,.48) !important;
  background:rgba(201,168,106,.16) !important;
  color:#f0e2c0 !important;
  cursor:pointer;white-space:nowrap;
}
#talent-layer-graph .graph-mode-bubble:hover{
  background:rgba(201,168,106,.26) !important;
  border-color:rgba(201,168,106,.7) !important;
  color:#fff8e8 !important;
}
#talent-layer-graph .graph-mode-bubble.active{
  background:linear-gradient(135deg,#e4cfa0,#c9a86a) !important;
  border-color:transparent !important;
  color:#1a1208 !important;
  box-shadow:0 4px 14px rgba(201,168,106,.3);
}

/* 我的能力个人图谱：必须有高度，否则 G6 容器为 0 一直空白 */
.ability-graph-page{display:flex;flex-direction:column;flex:1;min-height:0;height:100%}
.ability-graph-bar{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 20px;flex-shrink:0;
  border-bottom:1px solid rgba(201,168,106,.16);
}
.ability-graph-title{font-size:15px;font-weight:700;color:#e4cfa0}
.ability-graph-actions{display:flex;align-items:center;gap:10px}
.ability-graph-wrap{flex:1 1 auto;min-height:320px;height:100%;position:relative;overflow:hidden}
.ability-graph-foot{
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;
  padding:10px 20px;flex-shrink:0;
  border-top:1px solid rgba(201,168,106,.14);
}
.ability-graph-summary{font-size:12px;color:rgba(213,224,219,.7)}

/* 右侧技术详情高对比（不依赖 body 选择器，避免嵌入场景失效） */
#talent-detail-province .tech-detail-section-title{color:#c9a86a !important;letter-spacing:.04em}
#talent-detail-province .tech-detail-section-title::before{background:#c9a86a !important}
#talent-detail-province .tech-detail-text{color:#d8e2dc !important}
#talent-detail-province .tech-detail-name{color:#eef3ef !important}
#talent-detail-province .tech-detail-tag{
  background:rgba(201,168,106,.14) !important;
  color:#f0e2c0 !important;
  border:1px solid rgba(201,168,106,.38) !important;
}
#talent-detail-province .tech-detail-tag--kp,
#talent-detail-province .tech-detail-path-item{
  background:rgba(143,168,148,.22) !important;
  color:#eef3ef !important;
  border:1px solid rgba(168,184,154,.42) !important;
  padding:4px 10px;border-radius:6px;
}
#talent-detail-province .tech-detail-path-arrow{color:rgba(228,207,160,.65) !important}
#talent-detail-province .tech-detail-stats{
  background:rgba(8,16,14,.55) !important;
  border:1px solid rgba(201,168,106,.25) !important;
  border-radius:10px;
}
#talent-detail-province .tech-detail-stat-row{
  border-bottom-color:rgba(255,255,255,.1) !important;
  align-items:flex-start;gap:12px;
}
#talent-detail-province .tech-detail-stat-label{color:rgba(213,224,219,.7) !important;flex-shrink:0}
#talent-detail-province .tech-detail-stat-value{
  color:#e4cfa0 !important;text-align:right;line-height:1.55;
  word-break:break-word;max-width:64%;white-space:normal;
}
#talent-detail-province .tech-detail-stat-value--jobs{font-size:12px !important;color:#d5e0db !important}
#talent-detail-province .tech-detail-header{border-bottom-color:rgba(201,168,106,.22) !important}
#talent-detail-province .tech-detail-hot-star{color:#c9a86a !important}
"""

text = CSS_PATH.read_text(encoding="utf-8")
marker = "FIX 20260825c"
if marker in text:
    # replace old block
    start = text.find("/* ===== FIX 20260825c")
    # find next ===== after or end
    end = text.find("/* =====", start + 10)
    if end < 0:
        text = text[:start] + BLOCK.lstrip("\n")
    else:
        text = text[:start] + BLOCK.lstrip("\n") + text[end:]
    CSS_PATH.write_text(text, encoding="utf-8")
    print("replaced fix block")
else:
    CSS_PATH.write_text(text.rstrip() + "\n" + BLOCK + "\n", encoding="utf-8")
    print("appended fix block")
