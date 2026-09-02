# crawler · 智联招聘数据采集模块

从智联招聘采集岗位数据，清洗后写入 PostgreSQL（`zhilian_crawl_db` @ 3309），
落库到 `job_postings`（总表）+ `job_posting_details`（细节表，1:1）。

## 团队协作 · 一句话

> **每人本地各自聚合全组数据** —— 不需要中央服务器、不需要公网 IP。
> 用一个共享文件夹（飞书群文件/坚果云/U盘 均可）传递 `.jsonl.gz` 包，
> 5 个人各自在自己电脑上跑两行命令,就各自拥有一份全组合并后的库。

### 每个人的工作流（两行命令搞定）

```bash
# ① 把自己爬的数据导出到共享文件夹（给你的站名）
python -m crawler.export --site zhilian --output shared/zhilian_王五.jsonl.gz

# ② 把全组共享文件夹里的所有包导入到自己本地库
python merge_single.py --input shared/*.jsonl.gz
```

跑完第 ② 步,**你自己的库就有了全组合并后的数据**——不需要等任何人、不需要连任何人的电脑。

### 给接收方（不会 Python 的人）发的就两样

```
① merge_single.py          单文件版（自给自足，仅需 pip install "psycopg[binary]"）
② shared/*.jsonl.gz        全组的导出包
```

对方拿到后:
```bash
pip install "psycopg[binary]"        # 装依赖
python merge_single.py --input shared/zhilian_*.jsonl.gz shared/boss_*.jsonl.gz
```

---

## 目录结构

```
crawler/
├── config.py            # DB(3309) 连接 + 抓取参数 + UA 池
├── init_db.py           # 建库 + 执行 schema.sql + 验证
├── export.py            # 导出本地库为 JSONL.gz（采集人用）
├── merge.py             # 项目内版 merge（开发者用）
├── merge_single.py      # 单文件版 merge（发队友用，零依赖）
├── db.py models.py parser.py pipeline.py run.py
├── spiders/zhilian.py zhilian_pw.py
├── sql/schema.sql
├── fixtures/ shared/    # shared/ 放全组共享的导出包
└── requirements.txt
```

## 快速开始（采集 → 导出 → 合并）

```bash
# 0) 一次：装依赖
pip install -r crawler/requirements.txt

# 1) 一次：建库
python -m crawler.init_db

# 2) 采集：实时抓取（Playwright 渲染，过反爬）
python -m crawler.warmup                         # 首次手动过验证
python -m crawler.run --source live --mode playwright -k Java -c 530 --max-pages 3 --limit 100

# 3) 导出：把本地库导出为可分享的 .jsonl.gz
python -m crawler.export --site zhilian --output shared/zhilian_xxx.jsonl.gz

# 4) 合并：把全组共享包导入自己本地库
python merge_single.py --input shared/*.jsonl.gz
```

## 实时抓取工作流（重要）

智联对纯 HTTP 直连接口反爬（返回 405 / 验证页），因此 live 默认走 **Playwright 真实浏览器**：

1. **首次预热**（在你自己的终端，会弹浏览器，需交互）：
   ```bash
   python -m crawler.warmup
   ```
   在窗口里手动完成滑块/点选验证，看到正常岗位列表后回终端按回车。
   会话 cookie 存入 `crawler/.pw_profile`。
2. **抓取**（复用已验证会话，免再验证）：
   ```bash
   python -m crawler.run --source live --mode playwright -k Java -c 530 --max-pages 3 --limit 100
   ```
3. cookie 过期后重新 `warmup` 一次即可。

## 多采集人协作汇总（5 人分工 → 各人本地聚合）

**场景**：5 人各爬一个网站（zhilian / boss / lagou / liepin / 51job），
各自本地跑独立 PG，各自导出 `.jsonl.gz` 到 `shared/`，每人在自己电脑合并到本地库。
**零网络耦合** —— 共享文件夹用飞书群文件/坚果云/U盘都行。

### 表结构统一

所有人用同一个 DDL：`crawler/sql/schema.sql`（`job_postings` + `job_posting_details` 1:1）。
主键防重：`UNIQUE (source_name, source_id_hash)` —— 同一岗位多次提交自动 upsert，
触发器自动重算 `fingerprint` / `completeness`。

### 站名分工表（请按你实际情况填入）

| 站名 | source_name | 责任人 | 备注 |
|------|-------------|--------|------|
| 智联 | `zhilian` | | Playwright 渲染 |
| BOSS | `boss` | | |
| 拉勾 | `lagou` | | |
| 猎聘 | `liepin` | | |
| 51job | `51job` | | |

### 各采集人

```bash
# ① 一次：建库
python -m crawler.init_db

# ② 一次：warmup 过验证
python -m crawler.warmup

# ③ 采集
python -m crawler.run --source live --mode playwright -k Java Python -c 530 --max-pages 5

# ④ 导出到共享文件夹
python -m crawler.export --site zhilian --output shared/zhilian_xxx.jsonl.gz
#   全量:  --site zhilian
#   增量:  --site zhilian --since 2026-07-20
#   默认输出: ./exports/{site}_crawl_{YYYY-MM-DD}.jsonl.gz
```

### 合并到自己本地库

```bash
# 收到 shared/ 里所有人的包后（拷贝过来或共享文件夹自动同步）：

# 项目内版（你已经 clone 了项目）
python -m crawler.merge --input shared/*.jsonl.gz

# 单文件版（推荐发给不参与开发的队友）
python merge_single.py --input shared/zhilian_*.jsonl.gz shared/boss_*.jsonl.gz
```

合并特性：
- **幂等**：重复导同一份包不会创建重复行
- **冲突策略**：`(source_name, source_id_hash)` 命中 → UPDATE；否则 INSERT
- **触发器自动**：导入后 fingerprint / completeness / updated_at 自动重算
- **多包**：一个命令吃多个文件，串行 upsert

### 验收 SQL（导入后跑）

```sql
-- 各 source 数量（应该等于全组合并数）
SELECT source_name, count(*) FROM job_postings GROUP BY 1;

-- 完整度均值
SELECT source_name, round(avg(completeness),1)
FROM job_postings GROUP BY source_name;

-- 数据已上架率
SELECT source_name,
       count(*) FILTER (WHERE status=0) AS active,
       count(*) FILTER (WHERE status=1) AS offline
FROM job_postings GROUP BY source_name;
```

### 注意事项

1. **source_name 必须全局唯一且固定**：智联=`zhilian`，BOSS=`boss`...；一旦定下来不能改。
2. **source_id 必须是平台原始岗位 ID**（如智联 `CC...J40...`），会被 SHA256 成 `source_id_hash`。
3. **DDL 一致**：所有人用 `crawler/sql/schema.sql` 这份脚本建表，不要本地改字段。
4. **导出包大小**：13K 条智联 ≈ 30MB gzip，5 个站合计约 150MB，普通飞书文件能传。
5. **不要导出到远端共享盘后改文件名**：包头里有 `source` 字段做校验，文件名错乱会被 dry-run 拦下。

## 连接配置

默认读环境变量，缺省回落本地开发值：

| 变量 | 默认 |
|------|------|
| PG_HOST | 127.0.0.1 |
| PG_PORT | 3309 |
| PG_USER | postgres |
| PG_PASSWORD | 123456 |
| PG_DB | zhilian_crawl_db |

## 爬虫思路

1. **入口**：智联搜索 JSON 接口，按 `关键词 × 城市 × 页码` 遍历，列表页即含大部分字段。
2. **反爬**：随机 UA + 合理 Referer/Origin；请求间隔 1~3s 随机；失败指数退避重试；
   单关键词×城市设 `max_pages` 上限。接口若升级签名/触发验证码，切 Playwright 兜底。
3. **解析**：raw JSON → `parser` 清洗（薪资区间/月数、经验年限、学历归一、JD 切分）→ `JobItem`；
   原始 JSON 存 `raw_html`，智联特有字段进 `extra(JSONB)`。
4. **落库**：`job_postings` ON CONFLICT(source_name,source_id_hash) upsert，
   拿回 id 再 upsert `job_posting_details`；`fingerprint`/`completeness` 由触发器自动生成。

## 状态

- ✅ 数据库、两表、索引、触发器、视图已在 3309 建好
- ✅ 解析 → 落库 → 触发器 → 数组/JSONB → 统计视图 全链路离线验证通过
- ✅ live 抓取改为 Playwright 渲染 + XHR 拦截，绕开直连接口 405；配合 `warmup`
  持久化会话过反爬验证
- ✅ `export` + `merge` 文件交换方案：5 人各自爬、汇到你本机 3309 一库

---

## 多采集人协作汇总（5 人分工 → 本地汇总）

**场景**：5 人各爬一个网站（zhilian / boss / lagou / liepin / 51job），
各自本地跑独立 PG，各自导出 `.jsonl.gz` 包，汇总方（你）导入 3309 主库。
**零网络耦合** —— 大家不必互相通，文件用飞书/U盘/邮件传都行。

### 表结构统一

所有人用同一个 DDL：`crawler/sql/schema.sql`（`job_postings` + `job_posting_details` 1:1）。
主键防重：`UNIQUE (source_name, source_id_hash)` —— 同一岗位多次提交自动 upsert，
触发器自动重算 `fingerprint` / `completeness`。

### 各采集人工作流

```bash
# ① 一次：建库（每人自己的 PG；端口随意，DSN 跟上即可）
python -m crawler.init_db

# ② 一次：warmup 过验证（仅需浏览器渲染的站需要）
python -m crawler.warmup

# ③ 采集：跑你自己的爬虫
python -m crawler.run --source live --mode playwright -k Java Python -c 530 --max-pages 5

# ④ 导出 JSONL.gz 包（增量推荐：加 --since）
python -m crawler.export --site zhilian \
    --dsn "host=127.0.0.1 port=5432 user=postgres password=xxx dbname=zhilian_crawl_db" \
    --output exports/zhilian_2026-07-26.jsonl.gz
#   全量:  --site zhilian
#   增量:  --site zhilian --since 2026-07-20
#   默认导出路径: ./exports/{site}_crawl_{YYYY-MM-DD}.jsonl.gz

# ⑤ 把 .jsonl.gz 传给汇总方（你）
```

> **站点分工表**（请按表填入你的站名/姓名，替换示例）：

| 站名 | source_name | 责任人 | 备注 |
|------|-------------|--------|------|
| 智联 | `zhilian` | | Playwright 渲染 |
| BOSS | `boss` | | |
| 拉勾 | `lagou` | | |
| 猎聘 | `liepin` | | |
| 51job | `51job` | | |

### 汇总方（你）工作流

**方式 A：项目内（你已经 clone 了整个 `crawler/`）**

```bash
# 收到文件后：dry-run 校验包头（source 是否对得上站名）
python -m crawler.merge --input exports/*.jsonl.gz --dry-run

# 实际导入（支持多个文件，自动 upsert）
python -m crawler.merge --input exports/zhilian_*.jsonl.gz exports/boss_*.jsonl.gz
```

**方式 B：发给接收方用单文件版（推荐，发给不参与开发的人）**

接收方只需要：
1. Python 3.10+
2. `pip install "psycopg[binary]"`
3. `merge_single.py`（项目里 `crawler/merge_single.py`，自给自足，无项目依赖）
4. 包文件

```bash
# dry-run 校验
python merge_single.py --input zhilian_roundtrip.jsonl.gz --dry-run

# 实际导入（默认连本机 3309 / postgres / 123456）
python merge_single.py --input zhilian_roundtrip.jsonl.gz

# 自定义 DSN
python merge_single.py \
    --input zhilian_*.jsonl.gz boss_*.jsonl.gz \
    --dsn "host=192.168.1.10 port=5432 user=crawler password=xxx dbname=zhilian_crawl_db"
```

**两种方式功能完全等价**，区别只是分发形式。

合并特性：
- **幂等**：重复导同一份包不会创建重复行
- **冲突策略**：`(source_name, source_id_hash)` 命中 → UPDATE；否则 INSERT
- **触发器自动**：导入后 fingerprint / completeness / updated_at 自动重算
- **多包**：一个命令吃多个文件，串行 upsert

### 验收 SQL（导入后跑）

```sql
-- 各 source 数量
SELECT source_name, count(*) FROM job_postings GROUP BY 1;

-- 完整度均值
SELECT source_name, round(avg(completeness),1)
FROM job_postings GROUP BY source_name;

-- 数据已上架率
SELECT source_name,
       count(*) FILTER (WHERE status=0) AS active,
       count(*) FILTER (WHERE status=1) AS offline
FROM job_postings GROUP BY source_name;
```

### 注意事项

1. **source_name 必须全局唯一且固定**：智联=`zhilian`，BOSS=`boss`...；一旦定下来不能改。
2. **source_id 必须是平台原始岗位 ID**（如智联 `CC...J40...`），会被 SHA256 成 `source_id_hash`。
3. **DDL 一致**：所有人用 `crawler/sql/schema.sql` 这份脚本建表，不要本地改字段。
4. **导出包大小**：13K 条智联 ≈ 30MB gzip，5 个站合计约 150MB，普通飞书文件能传。
5. **不要导出到远端共享盘后改文件名**：包头里有 `source` 字段做校验，文件名错乱会被 dry-run 拦下。
