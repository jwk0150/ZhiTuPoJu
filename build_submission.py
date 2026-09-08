# -*- coding: utf-8 -*-
"""
一键生成《测试数据交付》：
  1 个既有岗位(Java开发工程师) + 1 个新岗位(AI应用工程师)
  能力图谱 / 岗位数据源 / 输入输出示例 / README
数据来源：本地 PostgreSQL zhitu_crawl_db（127.0.0.1:5433），真实岗位主表 the_total_table
方法：技能 = 从真实 JD 原文(job_description/job_requirement) 经“技能词典”抽取，可复现
"""
import csv
import io
import json
import re
import shutil
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import psycopg2

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "测试数据交付"


def _load_env(env_path: Path):
    d = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            d[k.strip()] = v.strip()
    return d


ENV = _load_env(ROOT / ".env")
PG = dict(host=ENV.get("PG_HOST", "127.0.0.1"), port=int(ENV.get("PG_PORT", "5433")),
          user=ENV.get("PG_USER", "postgres"), password=ENV.get("PG_PASSWORD", ""),
          dbname=ENV.get("PG_DB", "zhitu_crawl_db"))
conn = psycopg2.connect(**PG, connect_timeout=8)
conn.autocommit = True
cur = conn.cursor()

# ---------------- 技能词典：标准技能名 -> 图谱分类 ----------------
# 覆盖 IT 岗位 JD 里常见技术（编程语言/框架/数据/运维/AI/前端/架构/后端/测试/嵌入式/数据处理）
SKILL_DICT = {}
def add(cat, *names):
    for n in names:
        SKILL_DICT[n] = cat

add("编程语言", "java", "python", "golang", "go", "javascript", "js", "typescript",
    "kotlin", "swift", "php", "scala", "rust", "shell", "ruby", "c++", "c语言",
    "c#", "objective-c", "html5", "matlab", "汇编")
add("框架与开发", "spring boot", "springboot", "spring cloud", "springcloud", "mybatis",
    "dubbo", "netty", "vue", "react", "angular", "django", "flask", "fastapi",
    "node.js", "nodejs", "uniapp", "gin", "thinkphp", "laravel", "jquery", "hibernate", "spring")
add("数据存储与处理", "mysql", "redis", "mongodb", "postgresql", "oracle", "sqlite",
    "sql server", "elasticsearch", "kafka", "rocketmq", "rabbitmq", "hadoop", "spark",
    "hive", "flink", "clickhouse", "pandas", "numpy", "tidb", "doris", "starrocks",
    "etcd", "zookeeper", "druid", "greenplum", "hbase", "数据仓库", "数据湖")
add("工程化与运维", "docker", "kubernetes", "k8s", "jenkins", "gitlab", "ci/cd",
    "nginx", "linux", "git", "maven", "gradle", "prometheus", "grafana", "ansible",
    "tomcat", "webpack", "vite", "servicemesh", "istio", "terraform", "openstack")
add("AI与算法", "pytorch", "tensorflow", "scikit-learn", "cuda", "opencv", "transformer",
    "llm", "大模型", "rag", "agent", "langchain", "prompt", "提示词工程", "embedding",
    "微调", "fine-tuning", "深度学习", "机器学习", "nlp", "自然语言处理", "计算机视觉",
    "语音识别", "dify", "向量数据库", "mcp", "vllm", "onnx", "aigc", "强化学习",
    "目标检测", "ocr", "文生图", "智能体", "模型评测", "ragas", "text2sql")
add("前端技术", "html", "css", "echarts", "webgl", "three.js", "sass", "less",
    "小程序", "前端框架", "element ui", "antd", "tailwind")
add("架构设计", "微服务", "分布式", "高并发", "消息队列", "负载均衡", "缓存",
    "分布式事务", "服务治理", "中台", "领域驱动设计", "ddd", "降级", "限流", "灰度发布")
add("后端技术", "restful", "graphql", "websocket", "grpc", "接口开发", "rpc", "sse")
add("测试技术", "jmeter", "selenium", "自动化测试", "性能测试", "单元测试", "pytest",
    "junit", "postman", "appium", "功能测试", "测试用例", "uiautomator")
add("嵌入式/硬件", "stm32", "rtos", "嵌入式", "plc", "verilog", "pcb", "modbus",
    "单片机", "arm", "dsp", "can总线", "硬件设计", "fpga")
add("数据处理", "etl", "数据可视化", "tableau", "power bi", "数据清洗", "sql优化", "报表开发")

DETECT_TERMS = list(SKILL_DICT.keys())
_TERM_RE = {}
for t in DETECT_TERMS:
    if re.fullmatch(r"[a-z0-9][a-z0-9.+_-]*", t) and len(t) <= 5:
        _TERM_RE[t] = re.compile(r"(?<![a-z0-9])" + re.escape(t) + r"(?![a-z0-9])")
    else:
        _TERM_RE[t] = re.compile(re.escape(t))

LEVEL_MAP = {"不限": "初级", "无需经验": "初级", "在校生/应届生": "初级", "在校生应届生": "初级",
             "应届生": "初级", "1年": "初级", "1年以内": "初级", "经验不限": "初级", "1年以下": "初级",
             "2年": "中级", "1-3年": "中级", "2年以上": "中级", "3-5年": "中级", "3年以上": "中级",
             "3年及以上": "中级", "2-3年": "中级", "5-10年": "高级", "5年以上": "高级",
             "10年以上": "高级", "5-10年及以上": "高级", "5年及以上": "高级", "8年以上": "高级"}


def split_raw_skills(text: str):
    return [p.strip().strip('·.。') for p in re.split(r"[，,;；、/|\s]+", text or "") if p.strip()]


def normalize_hits(hits):
    """同义词归一：spring 系 / js / html5 / k8s 保留规范名，避免同一技能重复计数"""
    h = set(hits)
    orig = set(hits)
    h.discard("springboot"); h.discard("springcloud")
    h.discard("js"); h.discard("k8s"); h.discard("html5")
    has_boot = bool(orig & {"springboot", "spring boot"})
    has_cloud = bool(orig & {"springcloud", "spring cloud"})
    if has_boot or has_cloud:
        h.discard("spring")
    if has_boot:
        h.add("spring boot")
    if has_cloud:
        h.add("spring cloud")
    return list(h)


def extract_skills(text: str) -> list:
    """在 JD 原文中按词典抽取技能（每技能在一行记录里只算一次），并做同义词归一"""
    if not text:
        return []
    low = text.lower()
    found = set()
    for t in DETECT_TERMS:
        if _TERM_RE[t].search(low):
            found.add(t)
    return normalize_hits(found)


def fmt_date(d):
    if not d:
        return ""
    return d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)


def read_rows(sql, args):
    cur.execute(sql, args)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


# ---------------- 工具文件写入 ----------------
def jdump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def wcsv(path, headers, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(headers)
        w.writerows(rows)


# ---------------- 生成单岗位数据包 ----------------
def build_job(candidates: list, title_disp: str, folder: str, kind: str):
    job_dir = OUT / folder
    src_dir = job_dir / "岗位数据源"
    io_dir = job_dir / "输入输出示例"
    for d in (job_dir, src_dir, io_dir):
        d.mkdir(parents=True, exist_ok=True)

    rows = read_rows(
        """select id, source_name, company_name, city, salary_min, salary_max,
                  experience, education, publish_time, created_at,
                  job_description, job_requirement, skills, source_url
           from the_total_table
           where lower(job_title) = any(%s) order by publish_time nulls last, id""",
        (candidates,))
    n_total = len(rows)

    # 每个岗位记录抽取技能
    for r in rows:
        text = "\n".join(x for x in [r["job_description"], r["job_requirement"]] if x)
        raw = split_raw_skills(r["skills"])
        hit = extract_skills(text)
        for s in raw:
            key = s.lower()
            if key in SKILL_DICT and key not in hit:
                hit.append(key)
        r["_text"] = text
        r["_skills"] = normalize_hits(hit)

    with_skill = [r for r in rows if r["_skills"]]
    total = max(1, len(with_skill))
    counter = Counter()
    src_counter = Counter()
    for r in with_skill:
        for s in set(r["_skills"]):
            counter[s] += 1
        if r["source_name"]:
            src_counter[r["source_name"]] += 1

    top = sorted(counter.items(), key=lambda x: (-x[1], x[0]))
    # 图谱只纳入出现 >=2 次的技能点，避免低频噪音；样本极少时兜底取最高频 3 个
    used = [x for x in top if x[1] >= 2] or top[:3]
    cats = {}
    for s, c in used:
        cats.setdefault(SKILL_DICT[s], []).append((s, c))
    categories = []
    for name, items in sorted(cats.items(), key=lambda x: -sum(v for _, v in x[1])):
        categories.append({
            "name": name, "type": "category",
            "skillCount": len(items),
            "technologies": [{"name": n, "type": "technology", "frequency": c,
                              "ratio": round(c / total * 100, 1)}
                             for n, c in sorted(items, key=lambda x: -x[1])[:40]]})

    # 级别
    level_buckets = {}
    for r in with_skill:
        lv = LEVEL_MAP.get((r["experience"] or "").strip(), "不限/其他")
        level_buckets.setdefault(lv, []).append(r)
    levels = []
    for lv, lrows in level_buckets.items():
        lc = Counter()
        for r in lrows:
            for s in set(r["_skills"]):
                lc[s] += 1
        levels.append({"name": lv, "type": "level", "recordCount": len(lrows),
                       "technologies": [{"name": n, "frequency": c}
                                        for n, c in sorted(lc.items(), key=lambda x: -x[1]) if c >= 2][:24]})
    lv_order = {"初级": 0, "中级": 1, "高级": 2, "不限/其他": 3}
    levels.sort(key=lambda x: lv_order.get(x["name"], 9))

    _dts = [r["publish_time"] or r["created_at"] for r in rows
            if r["publish_time"] or r["created_at"]]
    data_source = {
        "table": "the_total_table",
        "方法": "从 job_description/job_requirement 原文按技能词典抽取技能点（词典含 %d 词）" % len(SKILL_DICT),
        "岗位标题匹配": candidates,
        "records": n_total,
        "withSkills": len(with_skill),
        "来源平台": [k for k, _ in src_counter.most_common(8)],
        "时间范围(发布时间/入库时间)": [fmt_date(min(_dts)) if _dts else "", fmt_date(max(_dts)) if _dts else ""],
    }
    graph = {
        "kind": kind, "jobTitle": title_disp, "dataSource": data_source,
        "skillCount": len(used),
        "uniqueSkills": [n for n, _ in used][:300],
        "categories": categories, "levels": levels,
        "maxFrequency": max([c for _, c in used] or [0]),
    }
    jdump(job_dir / "能力图谱.json", graph)

    # CSV：岗位数据源（真实 JD，含技能抽取结果与来源链接）
    wcsv(src_dir / "jobs_岗位源.csv",
         ["id", "source_name", "company", "city", "salary_min", "salary_max",
          "experience", "education", "publish_time", "source_url",
          "抽取技能", "jd长度"],
         [[r["id"], r["source_name"], r["company_name"], r["city"],
           r["salary_min"] or "", r["salary_max"] or "", r["experience"] or "",
           r["education"] or "", fmt_date(r["publish_time"]), r["source_url"] or "",
           "/".join(r["_skills"]) if r["_skills"] else "", len(r["_text"])]
          for r in rows])

    # 技能溯源
    wcsv(src_dir / "技能溯源.csv",
         ["技能", "出现岗位数", "出现率%", "分类", "来源平台", "示例岗位ID"],
         [[s, c, round(c / total * 100, 1), SKILL_DICT[s],
           "/".join(sorted({r["source_name"] for r in with_skill if s in r["_skills"]}) or ["-"]),
           "/".join(str(r["id"]) for r in with_skill if s in r["_skills"])[:3]]
          for s, c in top if c >= 2])

    # 输入输出示例：2 条真实 JD 原文
    samples = [r for r in rows if len(r["_text"]) > 150]
    if len(samples) < 2:
        samples = [r for r in rows if r["_text"]]
    for i, s in enumerate(samples[:2], 1):
        sk = "、".join(s["_skills"][:20]) or s["skills"] or ""
        txt = (f"【原始岗位 JD · 输入样例 {i}】\n岗位：{title_disp}\n公司：{s['company_name'] or ''}"
               f"  城市：{s['city'] or ''}\n薪资：{s['salary_min'] or ''}-{s['salary_max'] or ''}K"
               f"  经验：{s['experience'] or ''}  学历：{s['education'] or ''}\n"
               f"发布时间：{fmt_date(s['publish_time'])}  来源：{s['source_name'] or ''}\n"
               f"来源链接：{s['source_url'] or ''}\n\n--- 招聘描述/要求(原文) ---\n{s['_text'][:2800]}\n\n"
               f"--- 技能标签列 ---\n{s['skills'] or ''}\n\n"
               f"--- 本系统抽取技能点 ---\n{sk}\n")
        (io_dir / f"输入-JD样例{i}.txt").write_text(txt, encoding="utf-8")

    jdump(io_dir / "输出-能力图谱.json", graph)

    # 能力变化（时间窗口 diff：既有岗位动态更新）
    # 说明：本测试快照若为单批入库（无时间跨度），则不生成 diff 文件，避免空结果误导。
    diff = {"jobTitle": title_disp,
            "方法": "按入库时间(created_at)把样本切为 A/B 两批，比较技能出现率，输出 added/removed/modified（演示 diff 结构；批次间隔很短时差异主要反映批次样本构成，不代表长期趋势）",
            "added": [], "removed": [], "modified": [], "note": "added=新增/显著上升技能；removed=消失/显著下降技能；modified=出现率明显抬升技能"}
    # 使用 发布时间/入库时间/抓取时间 中跨度足够的字段做时间窗口对比
    for r in with_skill:
        r["_dt"] = r["publish_time"] or r["created_at"] or None
    timed = [r for r in with_skill if r["_dt"]]
    _dates = [r["_dt"].date() if hasattr(r["_dt"], "date") else r["_dt"] for r in timed]
    distinct_dates = set(_dates)
    if len(timed) >= 10 and len(distinct_dates) >= 2:
        times = sorted(r["_dt"] for r in timed)
        med = times[len(times) // 2]
        early, late = [], []
        for r in timed:
            (early if r["_dt"] < med else late).append(r)
        ne, nl = max(1, len(early)), max(1, len(late))
        ce, cl = Counter(), Counter()
        for r in early:
            for s in set(r["_skills"]):
                ce[s] += 1
        for r in late:
            for s in set(r["_skills"]):
                cl[s] += 1
        added, removed, modified = [], [], []
        for s in set(ce) | set(cl):
            re_, rl = ce.get(s, 0) / ne, cl.get(s, 0) / nl
            if rl >= 0.06 and re_ < 0.02 and cl.get(s, 0) >= 2:
                added.append({"name": s, "growth": f"+{round(rl * 100)}%",
                              "窗口出现率": f"{round(re_*100,1)}%→{round(rl*100,1)}%"})
            elif re_ >= 0.06 and rl < 0.02:
                removed.append({"name": s, "decline": f"-{round(re_ * 100)}%",
                                "窗口出现率": f"{round(re_*100,1)}%→{round(rl*100,1)}%"})
            elif rl - re_ >= 0.06 and re_ >= 0.02:
                modified.append({"name": s, "change": "↑ 需求上升",
                                 "窗口出现率": f"{round(re_*100,1)}%→{round(rl*100,1)}%"})
        diff["批次"] = {"A(早)": fmt_date(min(times)), "分界": fmt_date(med), "B(晚)": fmt_date(max(times)),
                        "A样本": len(early), "B样本": len(late)}
        diff["added"] = sorted(added, key=lambda x: -int(re.sub(r"[^\d]", "", x["growth"]) or 0))[:12]
        diff["removed"] = sorted(removed, key=lambda x: -int(re.sub(r"[^\d]", "", x["decline"]) or 0))[:12]
        diff["modified"] = modified[:12]
        if diff["added"] or diff["removed"] or diff["modified"]:
            jdump(io_dir / "输出-能力变化.json", diff)

    _write_viz_html(job_dir / "能力图谱-可视化.html", graph)
    return {"graph": graph, "diff": diff}


def _write_viz_html(path, graph):
    cats = [{"name": c["name"], "value": sum(t["frequency"] for t in c["technologies"])}
            for c in graph.get("categories", [])]
    top = []
    for c in graph.get("categories", []):
        for t in c["technologies"][:12]:
            top.append({"name": t["name"], "value": t["frequency"]})
    top.sort(key=lambda x: -x["value"])
    top = top[:20]
    src = graph["dataSource"]
    html = """<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>能力图谱 · __TITLE__</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<style>body{margin:0;font-family:'Microsoft YaHei',sans-serif;background:#faf8f4;color:#222}
h1{padding:18px 24px 0;font-size:20px}.sub{padding:0 24px;color:#555;font-size:13px;line-height:1.8}
.card{margin:16px 24px;background:#fff;border:1px solid #e7e1d2;border-radius:10px;padding:8px}
.h{font-weight:600;padding:10px 12px 2px}.chart{width:100%;height:360px}</style></head><body>
<h1>__TITLE__ 能力图谱</h1>
<p class="sub">数据源：__TABLE__ · __RECORDS__ 条岗位（含技能 __SKILLS__ 条）· 时间 __RANGE__ · 方法 __METHOD__</p>
<div class="card"><div class="h">技能分类分布</div><div id="c0" class="chart"></div></div>
<div class="card"><div class="h">高频技能 TOP 20</div><div id="c1" class="chart"></div></div>
<script>
var c0=echarts.init(document.getElementById('c0'));
c0.setOption({tooltip:{trigger:'item'},color:['#0d9488','#0ea5e9','#f59e0b','#6366f1','#ec4899','#84cc16','#8b5cf6','#ef4444','#14b8a6','#64748b'],
series:[{type:'pie',radius:['35%','70%'],label:{fontSize:12},data:__CATS__}]});
var c1=echarts.init(document.getElementById('c1'));
c1.setOption({tooltip:{},grid:{left:110,right:40},xAxis:{type:'value'},
yAxis:{type:'category',data:__NAMES__,axisLabel:{fontSize:11}},
series:[{type:'bar',data:__VALS__,itemStyle:{color:'#0d9488'},barMaxWidth:16}]});
window.addEventListener('resize',function(){c0.resize();c1.resize();});
</script></body></html>"""
    fmt = html.replace("__TITLE__", graph["jobTitle"])
    fmt = fmt.replace("__TABLE__", src.get("table", ""))
    fmt = fmt.replace("__RECORDS__", str(src.get("records", 0)))
    fmt = fmt.replace("__SKILLS__", str(src.get("withSkills", 0)))
    rng = src.get("时间范围(发布时间/入库时间)") or src.get("时间范围") or []
    fmt = fmt.replace("__RANGE__", "-".join(x for x in rng if x) or "—")
    fmt = fmt.replace("__METHOD__", src.get("方法", ""))
    fmt = fmt.replace("__CATS__", json.dumps(cats, ensure_ascii=False))
    fmt = fmt.replace("__NAMES__", json.dumps([t["name"] for t in top], ensure_ascii=False))
    fmt = fmt.replace("__VALS__", json.dumps([t["value"] for t in top]))
    path.write_text(fmt, encoding="utf-8")


# ==================== 主流程 ====================
def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    java = build_job(["java开发工程师"], "Java开发工程师",
                     "01-既有岗位-Java开发工程师", "existing")
    ai = build_job(["ai应用工程师", "ai应用开发工程师", "ai应用研发工程师"],
                   "AI应用工程师", "02-新岗位-AI应用工程师", "new")

    # 新岗位定义（比赛要求字段）
    cats_ai = {}
    for c in ai["graph"]["categories"]:
        cats_ai[c["name"]] = [t["name"] for t in c["technologies"]]
    core = []
    for name in ["AI与算法", "编程语言", "框架与开发", "数据存储与处理"]:
        core += cats_ai.get(name, [])[:6]
    plus = []
    for name in ["前端技术", "工程化与运维", "架构设计", "数据处理", "测试技术"]:
        plus += cats_ai.get(name, [])[:5]
    ds = ai["graph"]["dataSource"]
    definition = {
        "岗位名称": "AI应用工程师",
        "状态": "新兴岗位（真实招聘库中标题词簇 AI应用/大模型 快速涌现，技能组合新颖，尚未形成统一标准）",
        "定义": "面向企业真实业务构建大模型应用与智能体：负责 RAG 知识库、提示词工程、Agent 流程编排、"
                "大模型 API/私有化模型调用与效果调优，把大模型接入业务系统并保证可用性与可观测性。",
        "核心职责": ["业务 AI 应用/智能体方案设计与开发", "RAG 知识库、向量检索与提示词工程落地",
                      "大模型调用与效果调优、评测", "与产品/算法/后端协作完成功能交付与上线运维"],
        "必备技能": core[:12] or ["python", "pytorch", "大模型", "rag", "prompt", "langchain"],
        "加分技能": plus[:8],
        "典型应用场景": ["企业内部知识库问答助手", "客服/文档智能体", "业务流程自动化 Agent",
                        "AIGC 内容生产工具", "多模态检索应用"],
        "数据来源": {
            "表": "the_total_table", "岗位样本数": ds["records"], "含技能样本": ds["withSkills"],
            "来源平台": ds["来源平台"], "技能抽取方法": ds["方法"],
            "发现依据": "标题词簇(AI应用/大模型/LLM) 出现频次上升 + 技能组合新颖(RAG/Agent/LangChain/向量库)"},
    }
    jdump(OUT / "02-新岗位-AI应用工程师" / "岗位定义.json", definition)
    jdump(OUT / "02-新岗位-AI应用工程师" / "输入输出示例" / "输出-岗位定义.json", definition)

    wcsv(OUT / "总览表.csv",
         ["类别", "岗位", "数据源表", "岗位样本数", "含技能样本", "技能点数", "分类数", "可视化"],
         [["既有岗位", "Java开发工程师", "the_total_table", java["graph"]["dataSource"]["records"],
           java["graph"]["dataSource"]["withSkills"], java["graph"]["skillCount"],
           len(java["graph"]["categories"]), "能力图谱-可视化.html"],
          ["新岗位", "AI应用工程师", "the_total_table", ai["graph"]["dataSource"]["records"],
           ai["graph"]["dataSource"]["withSkills"], ai["graph"]["skillCount"],
           len(ai["graph"]["categories"]), "能力图谱-可视化.html"]])

    readme = f"""# 测试数据交付说明

> 对应比赛《作品提交形式》第③条：**1 个新岗位和 1 个既有岗位的能力图谱及岗位数据源（含输入输出示例）**
> 数据取自本地 PostgreSQL `zhitu_crawl_db` 的真实岗位主表 `the_total_table`（51job / BOSS 直聘等平台，含 source_url 与 JD 原文）。

## 交付内容

| 岗位 | 类型 | 说明 |
|---|---|---|
| 01-既有岗位-Java开发工程师 | 既有岗位能力图谱 + 能力变化 | {java['graph']['dataSource']['records']} 条真实岗位，{java['graph']['dataSource']['withSkills']} 条含技能 |
| 02-新岗位-AI应用工程师 | 新岗位定义 + 能力图谱 | 新兴方向，{ai['graph']['dataSource']['records']} 条真实岗位 |

每个岗位目录均包含：

1. **能力图谱.json** —— 技能点级图谱：`categories`（按技术分类）+ `levels`（初级/中级/高级）+ `uniqueSkills`，每技能含出现岗位数与出现率
2. **能力图谱-可视化.html** —— 浏览器打开即可看图谱（分类占比 + TOP20 技能）
3. **岗位数据源/** —— 喂给图谱的真实岗位数据：
   - `jobs_岗位源.csv`：该岗位全部岗位记录（含来源链接、JD长度、**抽取技能**）
   - `技能溯源.csv`：每个技能 ↔ 出现岗位数 / 出现率 / 分类 / 来源平台 / 示例岗位ID
4. **输入输出示例/**：
   - `输入-JD样例*.txt`：1~2 条真实原始 JD（含招聘描述、来源链接、本系统抽取结果）
   - `输出-能力图谱.json`：以该批 JD 为输入，系统聚合出的图谱结果
   - `输出-能力变化.json`：*样本时间跨度 ≥ 2 天时自动生成*，给出该岗位早/晚窗口 新增/删除/变化 能力项（单批入库快照不生成，避免空结果误导）

## 方法（可复现）

```bash
start_db_tunnel.cmd                 # 确保数据库可连（127.0.0.1:5433）
python build_submission.py          # 在仓库根目录执行，重新生成本文件夹
```

- 技能抽取：把 `job_description + job_requirement` 原文按 **技能词典**（build_submission.py 内 `SKILL_DICT`，%d 词）抽取技能点；词典分类与 `backend/services.py` 的图谱分类对齐（编程语言 / 框架与开发 / 数据存储与处理 / 工程化与运维 / AI与算法 / 前端技术 / 架构设计 / 后端技术 / 测试技术 / 嵌入式 / 数据处理）
- 级别：按 `experience` 字段映射 初级/中级/高级
- 能力变化（可选输出）：按 `publish_time / created_at` 中位数切早/晚窗口比较技能出现率，输出 added / removed / modified；仅在样本时间跨度 ≥2 天时生成该文件
- 所有 CSV 用 UTF-8-BOM 编码，Excel 可直接打开；能力图谱可视化需联网加载 ECharts CDN，离线评审可截图替代
"""
    readme = readme % len(SKILL_DICT)
    (OUT / "README.md").write_text(readme, encoding="utf-8")

    # 清理临时探查脚本
    for p in (ROOT / "_probe3.py", ROOT / "_probe.py", ROOT / "_probe4.py",
              ROOT / "_inspect.py", ROOT / "_inspect2.py"):
        if p.exists():
            p.unlink()
    print("DONE OK")
    print("Java records=%d skills=%d" % (java["graph"]["dataSource"]["records"], java["graph"]["skillCount"]))
    print("AI   records=%d skills=%d" % (ai["graph"]["dataSource"]["records"], ai["graph"]["skillCount"]))


if __name__ == "__main__":
    main()
    conn.close()
