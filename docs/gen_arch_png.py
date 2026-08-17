# -*- coding: utf-8 -*-
"""用 Pillow 绘制『执图破局』总体项目架构图 PNG。"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 1180
img = Image.new("RGB", (W, H), "#f5f7fc")
d = ImageDraw.Draw(img)

FONT_DIR = r"C:\Windows\Fonts"

def font(size, bold=False):
    name = "msyhbd.ttc" if bold else "msyh.ttc"
    try:
        return ImageFont.truetype(FONT_DIR + "\\" + name, size)
    except Exception:
        return ImageFont.load_default()

F_TITLE = font(26, True)
F_SUB = font(13)
F_LAYER = font(15, True)
F_BT = font(14, True)
F_TX = font(11.5)
F_TX2 = font(10.5)
F_FN = font(11.5, True)

def rrect(x, y, w, h, r, fill=None, outline=None, width=1):
    d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=fill, outline=outline, width=width)

def txt(cx, y, s, f, fill, anchor="mm"):
    d.text((cx, y), s, font=f, fill=fill, anchor=anchor)

# 渐变近似（用纯色块代替）
COL = {
    "user": "#4f6ef0", "front": "#1EA8E8", "back": "#9b6bff",
    "data": "#f7971e", "crawl": "#22b573", "ai": "#f45c43",
}
PANEL = {"front": "#eef4ff", "back": "#f3efff", "data": "#fff5e6",
         "ai": "#ffeceb", "crawl": "#e9fbf1"}

def arrow(x1, y1, x2, y2, col="#5b6b8c", w=2):
    d.line([x1, y1, x2, y2], fill=col, width=w)
    # arrow head
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    L = 9
    for da in (2.6, -2.6):
        a = ang + da
        d.line([x2, y2, x2 - L * math.cos(a), y2 - L * math.sin(a)], fill=col, width=w)

# ---------- header ----------
txt(640, 44, "「执图破局」多源异构数据驱动岗位能力图谱 · 总体项目架构图", F_TITLE, "#1b2440")
txt(640, 70, "新岗位发现 · 能力动态演化 · 全景图谱 · 人岗匹配诊断", F_SUB, "#7a86a3")

# ---------- 用户 ----------
rrect(490, 90, 300, 54, 10, fill=COL["user"])
txt(640, 114, "用户 / 浏览器", F_LAYER, "#ffffff")
txt(640, 136, "Chrome / Edge / Firefox · localhost:8080", font(11), "#eaf0ff")
arrow(640, 144, 640, 176)
txt(660, 162, "HTTP / 静态资源 (:8080)", F_TX2, "#7a86a3")

# ---------- 前端层 ----------
rrect(120, 180, 1040, 220, 14, fill=PANEL["front"], outline="#bcd2ff", width=2)
rrect(120, 180, 1040, 34, 14, fill=COL["front"])
txt(140, 197, "前端层  frontend/  · 纯 HTML/CSS/JS 单页应用 (静态服务 :8080)", F_LAYER, "#ffffff")

def panel(x, y, w, h, title, lines, tcol="#1b2440"):
    rrect(x, y, w, h, 10, fill="#ffffff", outline="#d4e2ff")
    txt(x + 16, y + 22, title, F_BT, tcol)
    yy = y + 44
    for ln in lines:
        txt(x + 16, yy, ln, F_TX, "#48506b")
        yy += 21

panel(140, 228, 232, 156, "应用外壳 shell.js", [
    "· 统一导航 / 左侧菜单", "· 返回拦截 / 页面切换", "· 内嵌 iframe 框架",
    "· PAGE_HREF 路径集中管理"], )
panel(396, 228, 248, 156, "页面 pages/", [
    "· index / portal（门户）", "· insight（能力演化）",
    "· learning-path（学习路径）", "· new-skill（新增技能详情）"], )
panel(668, 228, 232, 156, "逻辑 js/pages/", [
    "· evolution.js（核心）", "· matching / discovery",
    "· graph / talents", "· lib/：ECharts·地图·axios"], )
# four functions
rrect(924, 228, 220, 156, 10, fill="#e3f7ff", outline="#9fe0f5")
txt(940, 247, "四大功能入口", F_BT, "#1b2440")
fns = ["① 新岗位发现", "② 能力动态更新", "③ 全景图谱", "④ 人岗匹配诊断"]
fy = 260
for f in fns:
    rrect(940, fy, 188, 24, 6, fill=COL["front"])
    txt(1034, fy + 12, f, F_FN, "#ffffff")
    fy += 30

arrow(640, 400, 640, 430)
txt(660, 418, "REST API / JSON  (:8000 /api/*)", F_TX2, "#7a86a3")

# ---------- 后端层 ----------
rrect(120, 434, 1040, 236, 14, fill=PANEL["back"], outline="#d9c9ff", width=2)
rrect(120, 434, 1040, 34, 14, fill=COL["back"])
txt(140, 451, "后端层  backend/  · FastAPI + Uvicorn（:8000）", F_LAYER, "#ffffff")

panel(140, 482, 500, 80, "接入层 routers/", [
    "agent(对话) · collection(采集) · discovery(新岗位)",
    "evolution(演化) · matching(匹配) · graph · data · talent_map"])
panel(664, 482, 476, 80, "业务 / 算法层", [
    "evolution_agent(时序图谱演化推理) · matching(匹配≥90%)",
    "services(画像/趋势) · llm(DeepSeek封装) · models · mappings"])
panel(140, 576, 1000, 74, "数据访问层", [
    "db.py / db_async.py（PostgreSQL 同步+异步驱动）",
    "data.py（查询封装） · job_pool.py（岗位池） · config.py · mappings.py"])

arrow(420, 650, 360, 700)
txt(300, 676, "SQL", F_TX2, "#7a86a3", anchor="mm")
arrow(900, 650, 960, 700)
txt(1020, 676, "HTTP", F_TX2, "#7a86a3", anchor="mm")

# ---------- 数据层 / AI层 ----------
rrect(120, 704, 490, 118, 14, fill=PANEL["data"], outline="#ffd9a0", width=2)
rrect(120, 704, 490, 34, 14, fill=COL["data"])
txt(140, 721, "数据层  PostgreSQL 15+", F_LAYER, "#ffffff")
txt(140, 750, "· job_postings（JD 主表）", F_TX, "#48506b")
txt(140, 772, "· job_posting_details（详情解析）", F_TX, "#48506b")
txt(140, 794, "· 触发器变更捕获 · 统计视图 / 索引", F_TX, "#48506b")

rrect(670, 704, 490, 118, 14, fill=PANEL["ai"], outline="#ffc2bb", width=2)
rrect(670, 704, 490, 34, 14, fill=COL["ai"])
txt(690, 721, "外部 / AI 层", F_LAYER, "#ffffff")
txt(690, 750, "· DeepSeek API（大模型推理引擎）", F_TX, "#48506b")
txt(690, 772, "· 招聘站点 / 行业报告（数据源）", F_TX, "#48506b")
txt(690, 794, "→ 推理：岗位发现 / 技能演化 / 问答", F_TX, "#48506b")

arrow(365, 822, 365, 852)
txt(385, 840, "ETL 写入", F_TX2, "#7a86a3")

# ---------- 采集层 ----------
rrect(120, 856, 1040, 120, 14, fill=PANEL["crawl"], outline="#a9efc6", width=2)
rrect(120, 856, 1040, 34, 14, fill=COL["crawl"])
txt(140, 873, "采集层  crawler/  · 多源异构数据采集", F_LAYER, "#ffffff")
txt(140, 900, "· spiders/（站点爬虫） · parser/（结构化解析） · exchange/（数据交换）", F_TX, "#48506b")
txt(140, 922, "· ops/（运维调度） · sql/（建表 DDL） · models/ · db.py · config.py", F_TX, "#48506b")
txt(140, 944, "采集 → 解析 → 写入 PostgreSQL → 后端分析 → 前端可视化（闭环）", F_TX2, "#3a7d52")

# ---------- legend ----------
rrect(120, 1000, 1040, 120, 14, fill="#ffffff", outline="#dde3f0", width=2)
txt(140, 1024, "分层职责", F_BT, "#1b2440")
legend = [
    ("采集层 crawler/  —— 多源异构数据爬取与结构化", "前端层 frontend/ —— 统一外壳 + 四大功能页面 + ECharts"),
    ("数据层 PostgreSQL —— 持久化 JD/详情/触发器变更捕获", "AI 层 DeepSeek —— 大模型推理（发现/演化/问答）"),
    ("后端层 backend/ —— FastAPI路由+演化Agent+匹配算法", "数据流：爬虫→库→后端分析→前端→学习路径/差距反馈"),
]
ly = 1048
for l, r in legend:
    txt(140, ly, l, F_TX, "#48506b", anchor="lm")
    txt(640, ly, r, F_TX, "#48506b", anchor="lm")
    ly += 22

txt(640, 1148, "ZhiTuPoJu · 执图破局 — 整体分层架构", F_SUB, "#7a86a3", anchor="mm")

out = r"C:\Users\28891\Desktop\zuixin\ZhiTuPoJu\docs\项目总体架构图.png"
img.save(out, "PNG")
print("saved:", out)
