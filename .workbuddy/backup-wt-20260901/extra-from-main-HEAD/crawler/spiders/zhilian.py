"""智联招聘爬虫。

爬虫思路
========
1. 数据入口：走智联搜索 JSON 接口（fe-api.zhaopin.com/c/i/search/positions），
   按 (关键词 × 城市 × 页码) 遍历。列表接口即返回结构化 JSON，单条就含
   标题/公司/薪资/经验/学历/城市/行业/福利/HR 等大部分字段，可直接填两张表。
2. 反爬：
   - 随机 User-Agent + 合理 Referer/Origin 头；
   - 请求间隔 1~3s 随机 sleep，避免匀速；
   - 失败指数退避重试（网络错误 / 非 200 / JSON 解析失败）；
   - 单关键词×城市设 max_pages 上限，防跑飞。
   （若接口升级为签名校验/触发验证码，切换 Playwright 兜底——见 fetch 注释位。）
3. 解析：raw JSON → parser 清洗（薪资/经验/学历/描述切分）→ JobItem。
   原始 JSON 存 raw_html 留底，智联特有字段进 extra。
4. 落库：交给 db.save_batch，写 job_postings + job_posting_details。

注：智联接口版本多变，map_result 对字段做多路兜底取值（get_any），
    live 接口不可用时可用 fixtures/zhilian_sample.json 走离线冒烟。
"""

from __future__ import annotations

import json
import random
import time
from datetime import datetime
from typing import Any, Iterator

import httpx

from crawler.config import CRAWL
from crawler import parser
from crawler.models import JobItem


# ----------------- 取值兜底 -----------------
def get_any(d: dict, *paths: str, default: Any = None) -> Any:
    """按多个候选路径取值，命中第一个非空。路径支持 'a.b.c' 点语法。"""
    for path in paths:
        cur: Any = d
        ok = True
        for key in path.split("."):
            if isinstance(cur, dict) and key in cur:
                cur = cur[key]
            else:
                ok = False
                break
        if ok and cur not in (None, "", [], {}):
            return cur
    return default


def _name_of(v: Any) -> Any:
    """智联很多字段是 {'name': 'xxx'} / {'items':[{'name':..}]} / [{'name':..}] 结构。

    提取不出标量时返回 None，避免把 dict/list 塞进标量列。
    """
    if isinstance(v, list) and v:
        v = v[0]
    if isinstance(v, dict):
        for k in ("name", "value", "label", "typeName", "text"):
            if k in v and not isinstance(v[k], (dict, list)):
                return v[k]
        if "items" in v and isinstance(v["items"], list) and v["items"]:
            first = v["items"][0]
            return first.get("name") if isinstance(first, dict) else first
        return None
    if isinstance(v, (dict, list)):
        return None
    return v


def _parse_dt(v: Any) -> datetime | None:
    if not v:
        return None
    if isinstance(v, (int, float)):
        try:
            return datetime.fromtimestamp(v / 1000 if v > 1e12 else v)
        except Exception:
            return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(v).strip(), fmt)
        except ValueError:
            continue
    return None


class ZhilianSpider:
    def __init__(self, cfg=CRAWL) -> None:
        self.cfg = cfg

    # ----------------- HTTP -----------------
    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": random.choice(self.cfg.user_agents),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": "https://sou.zhaopin.com/",
            "Origin": "https://sou.zhaopin.com",
        }

    def _sleep(self) -> None:
        time.sleep(random.uniform(self.cfg.request_min_interval, self.cfg.request_max_interval))

    def fetch_list_page(self, keyword: str, city: str, page: int) -> list[dict]:
        """抓取一页搜索结果，返回 raw result 列表。失败经重试仍失败则返回 []。"""
        params = {
            "kw": keyword,
            "cityId": city,
            "start": page * self.cfg.page_size,
            "pageSize": self.cfg.page_size,
            "kt": 3,
        }
        last_err: Exception | None = None
        for attempt in range(1, self.cfg.max_retries + 1):
            try:
                with httpx.Client(timeout=self.cfg.timeout, follow_redirects=True) as client:
                    resp = client.get(self.cfg.search_api, params=params, headers=self._headers())
                if resp.status_code != 200:
                    raise RuntimeError(f"HTTP {resp.status_code}")
                data = resp.json()
                # �open结构兜底：data.results / results / data.list
                results = get_any(data, "data.results", "results", "data.list", default=[])
                return results if isinstance(results, list) else []
            except Exception as e:  # noqa: BLE001
                last_err = e
                backoff = self.cfg.retry_backoff ** attempt + random.uniform(0, 1)
                print(f"  · [{keyword}/{city}/p{page}] 第{attempt}次失败: {e} → {backoff:.1f}s 后重试")
                time.sleep(backoff)
        print(f"  ! 放弃 [{keyword}/{city}/p{page}]: {last_err}")
        return []

    # ----------------- 解析 -----------------
    def map_result(self, raw: dict, keyword: str) -> JobItem:
        """智联单条 raw JSON → JobItem（兼容 fe-api 与 __INITIAL_STATE__.positionList）。"""
        source_id = str(get_any(raw, "number", "positionId", "jobId", "id", default="") or "")
        title = get_any(raw, "name", "jobName", "title")
        company = _name_of(get_any(raw, "companyName", "company.name", "company", default={}))

        # 薪资：优先 salaryReal(数值区间) 定 min/max，salary60(展示文本) 作描述
        sal = parser.parse_salary(get_any(raw, "salaryReal", "salary", "salary60", "salaryDesc"))
        salary60 = get_any(raw, "salary60", "salaryReal", "salary")
        if salary60:
            sal["salary_description"] = salary60
            # salaryReal 无月数信息时，从 salary60 文本补 "·13薪"
            if sal["salary_months"] is None:
                sal["salary_months"] = parser.parse_salary(salary60)["salary_months"]

        exp = parser.parse_experience(_name_of(get_any(raw, "workingExp", "workExp", "experience")))
        edu = parser.normalize_education(_name_of(get_any(raw, "education", "eduLevel", "edu")))

        benefits = _str_list(get_any(raw, "welfare", "welfareLabel", "welfareTagList",
                                     "jobDetailData.position.other.welfare",
                                     "jobDetailData.customAttributeInfo.welfareItems", default=[]))
        desc_labels = _str_list(get_any(raw, "jobDetailData.position.desc.labels", default=[]))
        skills = parser.clean_list(
            _str_list(get_any(raw, "skillLabel", "jobSkillTags", "skillTags", default=[]))
            + desc_labels
        )
        labels = _str_list(get_any(raw, "commercialLabel", "jobLabel", "searchTagList",
                                   "positionLabel", "companyScaleTypeTagsNew", default=[]))

        # 完整 JD 就藏在列表项的 jobDetailData 里（无需再抓验证码墙后的详情页）
        summary = get_any(raw, "jobDetailData.position.desc.description",
                          "jobSummary", "jobDesc", "description")
        desc, req = parser.split_description(summary)

        # HR 活跃度：activityLevel 是列表，取首个
        activity = get_any(raw, "jobDetailData.staff.activityLevel")
        online = activity[0] if isinstance(activity, list) and activity else _name_of(activity)

        city = _name_of(get_any(raw, "workCity", "city.items", "city"))
        district = _name_of(get_any(raw, "cityDistrict", "businessArea", "district"))

        item = JobItem(
            source_name=self.cfg.source_name,
            source_id=source_id or None,
            source_id_hash=parser.sha256(source_id) if source_id else parser.sha256(f"{title}{company}"),
            job_title=title,
            company_name=company,
            city=city,
            district=district,
            salary_min=sal["salary_min"],
            salary_max=sal["salary_max"],
            salary_unit=sal["salary_unit"] or "元/月",
            experience=exp["experience"],
            education=edu,
            job_type=_name_of(get_any(raw, "workType", "property", "jobType", "emplType", default="全职")),
            publish_time=_parse_dt(get_any(raw, "publishTime", "updateDate", "firstPublishTime", "createDate")),
            # ---- 细节 ----
            company_industry=_name_of(get_any(raw, "industryName", "industry", "company.industry")),
            company_size=_name_of(get_any(raw, "companySize", "company.size", "staffCard.staffNum")),
            company_nature=_name_of(get_any(raw, "property", "propertyName", "company.type", "companyType")),
            company_logo=get_any(raw, "companyLogo", "company.logo", "logo"),
            company_address=(get_any(raw, "jobDetailData.position.workLocation.workAddress",
                                     "workAddress", "securityAddressLabel", "address")
                             or None),
            company_intro=get_any(raw, "jobDetailData.company.base.introduce",
                                  "jobDetailData.company.companyInfo",
                                  "companyIntro"),
            job_description=desc,
            job_requirement=req,
            job_highlights=get_any(raw, "positionHighlight"),
            job_labels=labels,
            skills=skills,
            benefits=benefits,
            keywords=parser.clean_list([keyword] + skills),
            work_years_min=exp["work_years_min"],
            work_years_max=exp["work_years_max"],
            education_required=edu,
            major_required=_name_of(get_any(raw, "needMajor", "majorRequired")),
            language_required=_name_of(get_any(raw, "jobDetailData.position.base.language", default=None)),
            salary_description=sal["salary_description"],
            salary_months=sal["salary_months"],
            job_category_l1=_name_of(get_any(raw, "subJobTypeLevelName", "jobType.parent", "jobTypeLevel1")),
            # 优先用智联自带的 subJobTypeLevelName（Python/Java 等），否则反查 code
            job_category_l2=(get_any(raw, "subJobTypeLevelName")
                             or _name_of(get_any(raw, "jobDetailData.position.jobType.jobTypeLevelName",
                                                 "jobKeyword.keywords.0.itemValue"))
                             or _jobcat(get_any(raw, "subJobTypeLevel"))),
            job_category_l3=(_name_of(get_any(raw, "jobDetailData.position.jobType.subJobTypeLevelName",
                                             "jobDetailData.position.jobType.subJobType"))
                             or _jobcat(get_any(raw, "subJobTypeLevel"))),
            work_mode=_WORK_MODE_MAP.get(get_any(raw, "jobDetailData.stateInfo.state.workMode", "workMode", "workDateType"),
                                         _name_of(get_any(raw, "workMode", "workDateType"))),
            work_schedule=get_any(raw, "jobDetailData.position.base.workSchedule"),
            headcount=_to_int(get_any(raw, "recruitNumber", "headcount",
                                      "jobDetailData.position.base.recruitNumber")),
            publisher_name=_name_of(get_any(raw,
                "jobDetailData.staff.staffName", "staffCard.staffName", "staffCard.name", "hrName")),
            publisher_title=_name_of(get_any(raw,
                "jobDetailData.staff.hrJob", "staffCard.hrJob", "staffCard.title", "hrJob")),
            publisher_avatar=get_any(raw,
                "jobDetailData.staff.avatar", "staffCard.avatar", "hrAvatar"),
            online_status=online,
            response_time=get_any(raw, "staffCard.hrStateInfo", "hrStateInfo"),
            response_rate=get_any(raw, "feedbackRatio"),
            last_active_time=_parse_dt(get_any(raw, "jobDetailData.staff.lastActiveTime", "lastActiveTime")),
            source_url=get_any(raw, "positionURL", "positionUrl", "url", "redirectUrl"),
            extra=_build_extra(raw),
            raw_html=json.dumps(raw, ensure_ascii=False),
        )
        return item

    # ----------------- 主流程 -----------------
    def crawl(
        self,
        keywords: list[str] | None = None,
        cities: list[str] | None = None,
        max_pages: int | None = None,
    ) -> Iterator[JobItem]:
        keywords = keywords or list(self.cfg.keywords)
        cities = cities or list(self.cfg.cities)
        max_pages = max_pages or self.cfg.max_pages
        for kw in keywords:
            for city in cities:
                empty_streak = 0
                for page in range(max_pages):
                    results = self.fetch_list_page(kw, city, page)
                    if not results:
                        empty_streak += 1
                        if empty_streak >= 2:  # 连续两页空，认为到底
                            break
                        self._sleep()
                        continue
                    empty_streak = 0
                    for raw in results:
                        yield self.map_result(raw, kw)
                    self._sleep()


def _to_int(v: Any) -> int | None:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return None


def _str_list(v: Any) -> list[str]:
    """把标签类字段规整为字符串列表。

    兼容三种形态：["Java","Go"] / [{"value":"Java"}] / [{"typeName":"急招"}]。
    """
    if not v:
        return []
    if not isinstance(v, list):
        v = [v]
    out: list[str] = []
    for x in v:
        if isinstance(x, dict):
            out.append(x.get("value") or x.get("name") or x.get("label")
                       or x.get("typeName") or x.get("tagName"))
        else:
            out.append(x)
    return parser.clean_list(out)


# 智联 workMode -> 通用工作方式
_WORK_MODE_MAP = {"ONSITE": "坐班", "REMOTE": "远程", "HYBRID": "混合"}

# 智联 subJobTypeLevel 编号 -> 中文分类（来自 search/base/data 字典的子集，
# 命中不到的 code 会在首次抓取时自动补全到 _JOB_CAT_DICT 并落盘）。
_JOB_CAT_DICT: dict[str, str] = {
    "9000300110000": "Java",
    "9000300160000": "Python",
    "9000300190000": "算法工程师",
    "9000300200000": "架构师",
    "9000300260000": "测试开发",
    "9000200070000": "运维工程师",
    "20000100030000": "IT技术文员/助理",
    "20000200320000": "研发经理",
    "14000700010000": "脚本开发",
}


def _jobcat(code: str | None) -> str | None:
    if not code or not isinstance(code, str):
        return None
    return _JOB_CAT_DICT.get(code)


def _build_extra(raw: dict) -> dict:
    """把智联特有/嵌套字段收进 extra JSONB（避免 detail 表列被稀疏数据填满）。

    结构示例：
    {
      "company": { "url": "...", "number": "CC...", "scaleTags": ["已上市"], "financing": "..." },
      "hr": { "id": 1080102416, "authState": 0, "state": "6小时内回复" },
      "location": { "lat": 40.077, "lng": 116.247, "tradingArea": "...", "streetName": "...",
                     "securityAddressLabel": "...", "staticMapUrl": "..." },
      "category_codes": { "l1_code": "...", "l2_code": "..." },
      "position_meta": { "sourceType": 1, "isNew": true, "todayInterview": true,
                         "sourceTypeUrl": "...", "proxyModel": false, "rpo": false,
                         "abroadFlag": 2, "salaryCount": "..." },
      "commercial": { "labels": [...], "topLabel": "...", "matchInfo": {...} },
      "recruit": { "headcount": 1, "internshipMonths": 0, "weeklyDays": 0,
                   "settlementType": "...", "workDateType": "..." },
      "red_flags": { "urgent": true, "showUrgentTag": true, "bestEmployer": false }
    }
    """
    extra: dict = {}

    def add(key: str, val) -> None:
        if val not in (None, "", [], {}):
            extra[key] = val

    # 1) 公司相关（去重：companyUrl/number/scale 已单独列的不重复存）
    company_block = {}
    u = get_any(raw, "companyUrl")
    n = get_any(raw, "companyNumber", "rootCompanyNumber")
    scale_tags = _str_list(get_any(raw, "companyScaleTypeTagsNew", default=[]))
    financing = get_any(raw, "financingStage")
    if u: company_block["url"] = u
    if n: company_block["number"] = n
    if scale_tags: company_block["scaleTags"] = scale_tags
    if financing: company_block["financing"] = financing
    if company_block: extra["company"] = company_block

    # 2) HR 详情（id / 认证状态 / 状态文本 / activityLevel 列表）
    hr_block = {}
    hr_id = get_any(raw, "staffCard.id", "jobDetailData.staff.id")
    hr_auth = get_any(raw, "staffCard.authenticationState", "jobDetailData.staff.authenticationState")
    activity = get_any(raw, "jobDetailData.staff.activityLevel", "staffCard.hrStateInfo")
    if hr_id is not None: hr_block["id"] = hr_id
    if hr_auth is not None: hr_block["authState"] = hr_auth
    if activity: hr_block["state"] = activity
    if hr_block: extra["hr"] = hr_block

    # 3) 位置详情（坐标/商圈/街道/地址标签/静态地图）
    loc_block = {}
    lat = get_any(raw, "jobDetailData.position.workLocation.latitude")
    lng = get_any(raw, "jobDetailData.position.workLocation.longitude")
    if lat: loc_block["lat"] = lat
    if lng: loc_block["lng"] = lng
    for k_src, k_dst in (("tradingArea", "tradingArea"),
                          ("streetName", "streetName"),
                          ("securityAddressLabel", "securityAddressLabel"),
                          ("jobDetailData.position.workLocation.staticMapUrl", "staticMapUrl")):
        v = get_any(raw, k_src)
        if v: loc_block[k_dst] = v
    if loc_block: extra["location"] = loc_block

    # 4) 分类编码
    cat_codes = {}
    l1c = get_any(raw, "jobDetailData.position.jobType.subJobTypeLevel")
    l2c = get_any(raw, "jobDetailData.position.jobType.jobTypeLevel")
    if l1c: cat_codes["l1_code"] = l1c
    if l2c: cat_codes["l2_code"] = l2c
    if cat_codes: extra["category_codes"] = cat_codes

    # 5) 岗位元信息
    pm = {}
    for k_src, k_dst in (("positionSourceType", "sourceType"),
                          ("isNewPosition", "isNew"),
                          ("todayInterview", "todayInterview"),
                          ("salaryCount", "salaryCount"),
                          ("proxyModel", "proxyModel"),
                          ("rpoProxied", "rpo"),
                          ("jobDetailData.stateInfo.state.abroadFlag", "abroadFlag"),
                          ("positionSourceTypeUrl", "sourceTypeUrl")):
        v = get_any(raw, k_src)
        if v not in (None, "", [], {}):
            pm[k_dst] = v
    if pm: extra["position_meta"] = pm

    # 6) 商业/匹配标签
    comm = {}
    cl = _str_list(get_any(raw, "commercialLabel", default=[]))
    if cl: comm["labels"] = cl
    tl = get_any(raw, "topLabel")
    if tl: comm["topLabel"] = tl
    stl = _str_list(get_any(raw, "searchTagList", default=[]))
    if stl: comm["searchTags"] = stl
    if comm: extra["commercial"] = comm

    # 7) 招聘细节
    rec = {}
    intern_m = get_any(raw, "internshipMonths")
    weekly = get_any(raw, "weeklyInternshipDays")
    settle = get_any(raw, "settlementType")
    wdt = get_any(raw, "workDateType")
    if intern_m not in (None, "", 0): rec["internshipMonths"] = intern_m
    if weekly not in (None, "", 0): rec["weeklyDays"] = weekly
    if settle: rec["settlementType"] = settle
    if wdt: rec["workDateType"] = wdt
    if rec: extra["recruit"] = rec

    # 8) 红点/急聘
    rf = {}
    if get_any(raw, "isUrgent"): rf["urgent"] = True
    if get_any(raw, "jobDetailShowUrgentTag"): rf["showUrgentTag"] = True
    if get_any(raw, "orgBestEmployerFlag"): rf["bestEmployer"] = True
    if rf: extra["red_flags"] = rf

    # 9) JD 标签/关键词（冗余保存到 extra，便于 JSONB 索引一次查全）
    desc_labels = _str_list(get_any(raw, "jobDetailData.position.desc.labels", default=[]))
    skill_tags = _str_list(get_any(raw, "jobSkillTags", default=[]))
    if desc_labels: extra["desc_labels"] = desc_labels
    if skill_tags and skill_tags != skills_listed(raw):
        extra["skill_tags"] = skill_tags
    # 内部推荐关键词
    jk = get_any(raw, "jobDetailData.position.other.jobKeyword.keywords")
    if jk: extra["job_keywords"] = jk

    # 10) HR 全字段画像（greeting/hrOnlineState/lastOnlineTime/goldMedal...）
    staff_full = get_any(raw, "jobDetailData.staff")
    if isinstance(staff_full, dict):
        staff_clean = {k: v for k, v in staff_full.items() if v not in (None, "", [], {})}
        if staff_clean:
            # lastOnlineTime 是毫秒时间戳，转 ISO 更友好
            lot = staff_clean.get("lastOnlineTime")
            if isinstance(lot, (int, float)) and lot > 0:
                try:
                    from datetime import datetime
                    staff_clean["lastOnlineTimeISO"] = datetime.fromtimestamp(
                        lot / 1000 if lot > 1e12 else lot
                    ).isoformat()
                except Exception:
                    pass
            extra["staff_profile"] = staff_clean

    # 11) cardCustomJson（页面卡片内嵌的地址/公司/薪资60/位置类型）
    ccj = get_any(raw, "cardCustomJson")
    if isinstance(ccj, str):
        try:
            ccj_obj = json.loads(ccj)
            if isinstance(ccj_obj, dict) and ccj_obj:
                extra["card_custom"] = ccj_obj
        except Exception:
            pass

    # 12) 用户交互状态（已收藏/已关注HR/已投递/IM 会话）
    beh = get_any(raw, "jobDetailData.stateInfo.positionBehaviorState")
    if isinstance(beh, dict) and any(v not in (None, -1) for v in beh.values()):
        extra["behavior_state"] = beh
    ims = get_any(raw, "jobDetailData.stateInfo.imSessionInfoDetail")
    if isinstance(ims, dict) and ims:
        extra["im_session"] = ims

    # 13) 通用追踪/埋点（jdno 用于关联其他系统）
    ct = get_any(raw, "commonTrack")
    if isinstance(ct, dict) and ct:
        extra["common_track"] = ct

    # 14) 卡片/广告类型
    card = {}
    for k_src, k_dst in (("cardType", "cardType"),
                          ("jdCardType", "jdCardType"),
                          ("applyType", "applyType"),
                          ("chatWindow", "chatWindow"),
                          ("feedOperation", "feedOperation"),
                          ("salaryType", "salaryType"),
                          ("propertyCode", "propertyCode"),
                          ("workTypeCode", "workTypeCode"),
                          ("uuid", "uuid")):
        v = get_any(raw, k_src)
        if v not in (None, "", [], {}):
            card[k_dst] = v
    if card: extra["card_meta"] = card

    # 15) positionCommercialLabel（置顶/广告/付费推广）
    pcl = get_any(raw, "positionCommercialLabel")
    if isinstance(pcl, list) and pcl:
        extra["position_commercial_label"] = pcl

    # 16) 公司徽章（已上市/百人/国企等），冗余存到 extra 便于按徽章筛
    org_best = get_any(raw, "orgBestEmployerFlag", "jobDetailData.staff.auditNaturePrompt")
    if org_best: extra["org_best"] = org_best

    # 17) 职位根公司/集团信息
    jri = get_any(raw, "jobRootOrgInfo")
    if isinstance(jri, dict) and jri:
        extra["job_root_org"] = jri

    # 18) 召回权重（gWeight/gQuery 内部用）
    rs = get_any(raw, "recallSign")
    if isinstance(rs, dict) and rs:
        extra["recall_sign"] = rs

    # 19) 匹配/推荐信息（个性化推荐场景才有）
    mi = get_any(raw, "matchInfo", "jobHitReason", "jobHitReasonHighlights")
    if isinstance(mi, (dict, list)) and mi:
        extra["match_info"] = mi

    # 20) 关键词内部字典项（itemValue 列），通常空，跳过

    # 21) 标签展示元信息（颜色/高亮等，UI 用）
    sst = get_any(raw, "showSkillTags")
    if isinstance(sst, list) and sst:
        extra["show_skill_tags"] = sst

    # 22) 投递路径（小程序/H5/官网等）
    dp = get_any(raw, "deliveryPath", "jobDetailData.position.base.deliveryPath")
    if dp: extra["delivery_path"] = dp

    # 23) 城市/区域 ID（便于多维筛选）
    cids = {}
    cid = get_any(raw, "cityId")
    if cid: cids["cityId"] = cid
    wid = get_any(raw, "jobDetailData.position.workLocation.positionCityId")
    if wid: cids["workCityId"] = wid
    if cids: extra["city_ids"] = cids

    return extra


def skills_listed(raw: dict) -> list[str]:
    """和 map_result 里 skills 取值同步：仅用于判断 extra 是否重复。"""
    return _str_list(get_any(raw, "skillLabel", default=[]))
