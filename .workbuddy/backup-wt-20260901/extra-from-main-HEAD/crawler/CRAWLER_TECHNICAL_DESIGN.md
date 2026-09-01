# 智联招聘爬虫 · 技术设计文档

> 版本:v1.0  ·  日期:2026-07-26  ·  责任人:数据工程师
> 目标:把智联招聘的岗位数据,稳定、合规、可复用地产出到 PostgreSQL。

---

## 一、为什么不用纯 HTTP?

**直接打智联 JSON 接口,三次实测都不通**:

| 尝试 | 结果 |
|---|---|
| `GET https://fe-api.zhaopin.com/c/i/search/positions?kw=Java&cityId=530` | **HTTP 405**(Method Not Allowed) |
| `GET https://sou.zhaopin.com/?kw=Java&jl=530` | **200 但 1919 字节的反爬验证页**(含 captcha/验证关键词,无岗位数据) |
| 直连 XHR 接口 | 同样 405 或返回签名校验失败 |

**根因**:智联用了**前端签名 + Cookie + 滑块验证**三道防线,纯 HTTP 客户端无法过。

**结论**:必须用**真实浏览器渲染**绕开签名,用**持久化会话**绕过验证墙。

---

## 二、爬虫技术栈

| 层 | 技术 | 版本 | 作用 |
|---|---|---|---|
| 浏览器内核 | Chromium(Playwright bundled) | 130.x | 渲染 JS、加载 Cookie、绕签名 |
| 浏览器控制 | Playwright | 1.48.x | Python 同步 API + 持久化 context |
| 数据提取 | Chromium 内置 XHR 拦截 | — | 监听 `page.on('response')` 抓岗位 JSON |
| 数据落地 | psycopg | 3.2.x | 直连 PostgreSQL,upsert |
| 数据压缩 | gzip(stdlib) | — | 导出包压缩(约 10x) |

**不依赖**:
- ❌ `requests` / `httpx`(被验证墙挡)
- ❌ Selenium(性能差、被反爬识别)
- ❌ 任何代理池(暂无)
- ❌ LLM/API(本阶段不调用)

---

## 三、反爬策略(三层防线)

### 3.1 指纹伪装层

```python
# crawler/config.py & spiders/zhilian_pw.py
- 随机 User-Agent(3 种主流浏览器轮换)
- 中文 locale(zh-CN)
- 1440×900 视口(模拟桌面)
- 抹掉 navigator.webdriver:
  context.add_init_script(
    "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
  )
- 命令行参数: --disable-blink-features=AutomationControlled
```

### 3.2 会话持久化层

```python
# 用 launch_persistent_context 而非 launch+new_context
pw.chromium.launch_persistent_context(
    user_data_dir='crawler/.pw_profile',  # cookie / cache 持久化
    headless=False,                        # headful 模式更易过验证
    ...
)
```

**效果**:用户(`python -m crawler.warmup`)首次手动过验证后,**cookie 持久化**到 `.pw_profile` 目录。后续抓取**直接复用会话**,不再触发验证。

### 3.3 行为模拟层

```python
# 反爬节奏控制
- 请求间隔 1-3 秒随机(避免匀速)
- 单关键词×城市最大翻页 10 页
- 失败指数退避重试(2/4/8 秒)
- 连续 2 页空数据 = 自动停止(判定为到底)
```

### 3.4 验证页兜底层

```python
def _is_captcha(page) -> bool:
    html = page.content()
    return len(html) < 20000 and (
        "captcha" in html.lower() or
        "安全验证" in html or
        "拖动滑块" in html or
        "点选" in html
    )

# 检测到 → 暂停 60s 等用户手动过 → 继续
```

**关键**:智联搜索列表页用的**是普通滑块/点选**(用户可秒过);但**详情页 `jobdetail`**撞的是**腾讯天御更强的验证码**(我们过不了)——所以**只抓列表页,不抓详情页**。

---

## 四、核心发现:JD 全文藏在列表项里(零额外请求)

**诊断结果**:打开列表页控制台,捕获到的请求里没有任何独立的"详情 API"调用,但每个岗位项的 `window.__INITIAL_STATE__.positionList[].jobDetailData` 里**已经包含完整 JD 全文**。

```json
// 列表项原始结构(简化)
{
  "name": "Java开发工程师",
  "companyName": "字节跳动",
  "salaryReal": "20001-40000",
  "salary60": "2-4万",
  "workingExp": "3-5年",
  "education": "本科",
  "skillLabel": [{"value":"Java"}, {"value":"Go"}, ...],
  "welfareLabel": ["五险一金", ...],
  "jobDetailData": {
    "position": {
      "desc": {
        "description": "\"职位描述\\n1.负责后端服务...\\n2.参与高并发...\"",
        "labels": ["自动驾驶", "数据生产"]
      },
      "workLocation": {
        "workAddress": "北京海淀北清路81号院西区-1号楼",
        "latitude": "40.077...",
        "longitude": "116.247..."
      },
      "base": {"salary":"1.8-2万","positionName":"...", ...}
    },
    "staff": {
      "staffName": "许馨予",          // HR 姓名
      "hrJob": "Hr",
      "avatar": "...",
      "activityLevel": ["今日回复50+次"]   // HR 活跃度
    },
    "company": {...},
    "stateInfo": {"state":{"workMode":"ONSITE"}}
  },
  "positionURL": "http://www.zhaopin.com/jobdetail/CC...J40....htm",
  "positionHighlight": "...",
  "companyScaleTypeTagsNew": ["已上市"],
  "subJobTypeLevel": "9000300160000",
  "subJobTypeLevelName": ""     // ← 这个经常是空,用 code 反查
}
```

**好处**:**一次列表请求 = 完整岗位数据**,不需要逐条抓详情(否则撞腾讯验证墙)。

**字段填满率**(实测 13646 条):
- 总表 15 列:100% 满填(只剩 `district` 部分缺)
- 细节表 49 列:**30 列有值,22 列 100%**

---

## 五、数据解析管线

```
[智联 raw JSON]
    │
    ▼  get_any() 多路径兜底取值
    │
    ▼  parser.py 字段清洗
    │     ├─ parse_salary()      "25K-45K·15薪" → {25000, 45000, 15}
    │     ├─ parse_experience()   "3-5年" → {3, 5}
    │     ├─ normalize_education() "本科" → "本科"
    │     ├─ split_description()  "职位描述\n...任职要求..." → (desc, req)
    │     ├─ sha256()             source_id → 去重键
    │     └─ clean_list()         数组去重去空
    │
    ▼  map_result() 字段映射(含 9 类职位 code 反查)
    │
    ▼  db.py 类型适配
    │     ├─ JSONB 字段 → psycopg.types.json.Jsonb
    │     ├─ TEXT[] 字段 → 原生 list
    │     └─ 标量列遇到 dict/list → 降级 None(防御)
    │
    ▼  save_item() 落库
```

### 5.1 防御式解析关键代码

```python
# 标量列被赋了 dict/list 会报错,必须降级
def _coerce_posting(d):
    return {k: (None if isinstance(v, (dict, list)) else v) for k, v in d.items()}

# _name_of 处理智联常见的嵌套结构
def _name_of(v):
    """{'name': 'xxx'} / {'items': [{'name':..}]} / [{'name':..}] → 标量或 None"""
    if isinstance(v, list) and v: v = v[0]
    if isinstance(v, dict):
        for k in ("name", "value", "label", "typeName", "text"):
            if k in v and not isinstance(v[k], (dict, list)):
                return v[k]
        return None  # 拿不到就 None,绝不让 dict 漏到标量列
    if isinstance(v, (dict, list)): return None
    return v
```

### 5.2 职位分类反查

```python
# 智联列表只给 code(如 9000300160000),name 经常空
_JOB_CAT_DICT = {
    "9000300110000": "Java",
    "9000300160000": "Python",
    "9000300190000": "算法工程师",
    "9000300200000": "架构师",
    "9000300260000": "测试开发",
    "9000300200000": "IT技术文员/助理",
    "9000200070000": "运维工程师",
    "20000200320000": "研发经理",
    "14000700010000": "脚本开发",
}
# 共 9 个类,够覆盖当前样本
```

---

## 六、数据库设计(简化)

### 6.1 表结构(带前缀,智联站:`zhilian_job_postings` + `zhilian_job_posting_details`)

```
job_postings (总表,15 列)         job_posting_details (细节表,49 列)
├─ id BIGSERIAL PK                ├─ detail_id BIGSERIAL PK
├─ source_name VARCHAR(32)        ├─ job_id BIGINT FK→postings.id CASCADE
├─ source_id VARCHAR(64)          ├─ company_industry/size/nature/intro/...
├─ source_id_hash VARCHAR(64)     ├─ job_description/requirement/highlights
├─ UNIQUE(source_name,            ├─ job_labels/skills/benefits/keywords
│        source_id_hash)         │   (TEXT[])
├─ job_title / company_name       ├─ work_years_min/max
├─ city / district                ├─ salary_months / currency
├─ salary_min/max/unit            ├─ job_category_l1/l2/l3
├─ experience / education         ├─ work_mode / schedule / overtime / travel
├─ job_type / publish_time        ├─ headcount / deadline
├─ status SMALLINT (0=正常)        ├─ contact_* (智联无,留空)
└─ fingerprint (触发器自动)        ├─ publisher_name/title/avatar (HR 信息)
    └─ completeness (触发器自动)   ├─ online_status / response_time / rate
                                   ├─ source_url / extra (JSONB) / raw_html
                                   └─ updated_at (触发器自动)
```

### 6.2 三个触发器

```sql
-- 1. 指纹:title|company|city|salary|exp|edu 的 SHA256
CREATE TRIGGER trg_generate_fingerprint
    BEFORE INSERT OR UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION fn_generate_fingerprint();

-- 2. 完整度:15 个核心字段非空比例(0-100%)
CREATE TRIGGER trg_calculate_completeness
    BEFORE INSERT OR UPDATE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION fn_calculate_completeness();

-- 3. details.updated_at 自动刷新
CREATE TRIGGER trg_touch_updated_at
    BEFORE UPDATE ON job_posting_details
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
```

**好处**:Python 层不用算完整度、不用算指纹,触发器自动,**逻辑统一在 DDL 里**。

### 6.3 Upsert 幂等设计

```sql
-- 主键防重
ON CONFLICT (source_name, source_id_hash) DO UPDATE SET
    job_title=EXCLUDED.job_title, ...;

-- 详情表用 job_id 唯一约束
ON CONFLICT (job_id) DO UPDATE SET ...;
```

**好处**:同一岗位重复入库自动覆盖,**run 脚本可重跑**,merge 可重导。

---

## 七、工程结构

```
crawler/
├── config.py            # 全局配置(DBConfig + CrawlConfig)
├── create_schema.py     # 建库+DDL(支持任意 prefix)
├── db.py                # 落库层(save_item / save_batch + 类型适配)
├── models.py            # JobItem dataclass
├── parser.py            # 字段清洗工具(纯函数,无副作用)
├── pipeline.py          # 采集流水线编排
├── run.py               # CLI 入口(支持 live/fixture 模式)
├── warmup.py            # 首次会话预热(手动过验证)
├── export.py            # 导出本地库 → JSONL.gz(给汇总方)
├── merge.py             # 项目内版 merge
├── merge_single.py      # 单文件版 merge(零依赖,发队友用)
├── reenrich.py          # 重新解析已有 raw_html(改 map 后重灌)
├── spiders/
│   ├── zhilian.py      # 纯 HTTP 版(已废弃,留作 fallback)
│   └── zhilian_pw.py   # Playwright 版(主用)
├── sql/schema.sql       # 静态 DDL(无前缀)
├── fixtures/            # 离线样本
└── exports/             # 导出包落地点
```

---

## 八、运行工作流

### 8.1 首次(每个机器做一次)

```bash
pip install -r crawler/requirements.txt
python -m playwright install chromium    # 130 MB 下载
python -m crawler.create_schema --prefix zhilian   # 建库 zhilian_crawl_db
python -m crawler.warmup                # 弹出浏览器,手动过滑块
```

### 8.2 日常抓取

```bash
python -m crawler.run --source live --mode playwright \
  -k Java Python 算法工程师 -c 530 --max-pages 5 --limit 500
```

### 8.3 增量(可选)

```bash
python -m crawler.export --site zhilian --since 2026-07-20
python merge_single.py --input zhilian_xxx.jsonl.gz
```

---

## 九、可改进点(下一阶段)

| 改进 | 收益 | 工作量 |
|---|---|---|
| 9 类职位字典自动从 `search/base/data` 拉 | 永不缺分类 | 半天 |
| 多城市并行(北京/上海/广州/深圳/杭州) | 数据多样性 | 1 天 |
| 自动检测 cookie 过期 | 减少 warmup 次数 | 半天 |
| 代理池(应对大规模采集) | 防 IP 封 | 3 天 |
| 把 `_looks_like_jd_text(s)` 加进 map_result | 修字段错位 bug | 1 小时 |
| 增量指纹缓存(只解析新 ID) | 提速 reenrich | 半天 |
| 跨站调度器(同时跑 5 站) | 多源并发 | 2 天 |

---

## 十、合规与风险

| 风险 | 应对 |
|---|---|
| 智联 ToS 限制 | **仅采集公开数据**,遵守 robots.txt(智联搜索本身公开) |
| 个人隐私 | **不采集** HR 手机/邮箱等敏感字段(`contact_*` 留空) |
| 数据安全 | 数据库本地,密码强默认(`123456` 仅本地用,生产改) |
| 反爬升级 | 监控成功率,触发验证立即降速/暂停 |

**声明**:本爬虫仅用于科研竞赛(挑战杯 XH-202621),不商业化,采集量控制在合理范围(目标 1 万条)。

---

## 附录:实测数据

| 指标 | 数值 |
|---|---|
| 库名 | `zhilian_crawl_db` |
| 表名 | `zhilian_job_postings` / `zhilian_job_posting_details` |
| 数据量(过滤后) | 8619 条(严格 IT) |
| 字段填充率 | 22 列 100%,8 列 80-95% |
| 触发器覆盖 | 100% |
| 1:1 完整性 | 100%(无孤儿) |
| 包大小(13646 条全量) | 30.7 MB gzip |