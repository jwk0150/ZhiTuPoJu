"""导出/合并共享逻辑 —— v2 主数据 ID、表关联、统一宽表、本地媒体、UTF-8。"""

from __future__ import annotations

import json
import mimetypes
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

import httpx

EXPORT_SCHEMA_VERSION = 2
MASTER_ID_RE = re.compile(r"^\d{11}$")  # YYYYMM + 5 位序号，如 20260900001

TABLE_RELATIONS = {
    "master_key": "master_id",
    "tables": {
        "job_postings": {
            "role": "master",
            "primary_key": "master_id",
            "natural_key": ["source_name", "source_id_hash"],
            "links_to": ["job_posting_details", "job_unified"],
        },
        "job_posting_details": {
            "role": "child",
            "foreign_key": "master_id",
            "parent": "job_postings",
            "join": {"master_id": "master_id"},
        },
        "job_unified": {
            "role": "flat",
            "foreign_key": "master_id",
            "merged_from": ["job_postings", "job_posting_details"],
        },
    },
}

POSTING_EXPORT_COLS = (
    "source_name", "source_id", "source_id_hash",
    "job_title", "company_name", "city", "district",
    "salary_min", "salary_max", "salary_unit",
    "experience", "education", "job_type",
    "publish_time", "crawl_time", "status",
    "fingerprint", "completeness",
)

DETAIL_EXPORT_COLS = (
    "company_industry", "company_size", "company_nature", "company_intro",
    "company_address", "company_logo", "job_description", "job_requirement",
    "job_highlights", "job_labels", "skills", "benefits", "keywords",
    "work_years_min", "work_years_max", "education_required", "major_required",
    "language_required", "certificate_required", "salary_description",
    "salary_months", "salary_currency", "job_category_l1", "job_category_l2",
    "job_category_l3", "work_mode", "work_schedule", "overtime_status",
    "travel_status", "headcount", "deadline", "contact_name", "contact_phone",
    "contact_email", "contact_wechat", "resume_receive_email",
    "publisher_name", "publisher_title", "publisher_avatar",
    "response_rate", "response_time", "online_status", "last_active_time",
    "interview_count", "hire_count", "view_count", "apply_count",
    "favor_count", "source_url", "extra", "raw_html",
)

MEDIA_FIELD_MAP = (
    ("company_logo", "company_logo"),
    ("publisher_avatar", "publisher_avatar"),
)

EXTRA_MEDIA_KEYS = (
    "video_url", "videoUrl", "video", "cover_url", "coverUrl",
    "image_url", "imageUrl", "poster", "thumbnail", "thumb",
)

INTERNAL_DROP = frozenset({
    "_table", "_link", "_db_id", "detail_id", "job_id", "job_id_source",
})


class MasterIdGenerator:
    """主数据 ID：YYYYMM + 5 位序号，例 20260900001。"""

    def __init__(self, yyyymm: str | None = None, start: int = 1) -> None:
        self.prefix = yyyymm or datetime.now(timezone.utc).strftime("%Y%m")
        if len(self.prefix) != 6 or not self.prefix.isdigit():
            raise ValueError(f"invalid YYYYMM prefix: {self.prefix!r}")
        self.counter = start

    def next_id(self) -> str:
        if self.counter > 99999:
            raise ValueError(f"master_id sequence overflow for {self.prefix}")
        mid = f"{self.prefix}{self.counter:05d}"
        self.counter += 1
        return mid


def validate_master_id(master_id: str) -> bool:
    return bool(MASTER_ID_RE.match(str(master_id or "")))


def dumps_json_line(obj: dict) -> str:
    """UTF-8 JSON 行，中文不转义。"""
    return json.dumps(obj, ensure_ascii=False, default=str) + "\n"


def is_remote_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    v = value.strip()
    return v.startswith("http://") or v.startswith("https://")


def _guess_ext(url: str, content_type: str | None) -> str:
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".mp4", ".webm", ".mov"}:
        return suffix
    if content_type:
        ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if ext:
            return ext
    return ".bin"


def localize_url(
    url: str | None,
    *,
    master_id: str,
    field_tag: str,
    media_dir: Path,
    rel_prefix: str,
    timeout: float = 20.0,
) -> tuple[str | None, bool]:
    """下载远程媒体到 media_dir，返回相对路径。失败则保留原 URL。"""
    if not is_remote_url(url):
        return url, False

    media_dir.mkdir(parents=True, exist_ok=True)
    dest: Path | None = None
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url.strip())
            resp.raise_for_status()
            ext = _guess_ext(url, resp.headers.get("content-type"))
            dest = media_dir / f"{master_id}_{field_tag}{ext}"
            dest.write_bytes(resp.content)
    except Exception:
        return url, False

    rel = f"{rel_prefix}/{dest.name}".replace("\\", "/")
    return rel, True


def localize_record_media(
    record: dict,
    *,
    master_id: str,
    media_dir: Path,
    rel_prefix: str,
) -> dict:
    """将记录中的图片/视频 URL 换成本地相对路径。"""
    out = dict(record)
    stats = {"downloaded": 0, "kept_remote": 0}

    for field, tag in MEDIA_FIELD_MAP:
        val = out.get(field)
        if not val:
            continue
        new_val, ok = localize_url(
            val, master_id=master_id, field_tag=tag,
            media_dir=media_dir, rel_prefix=rel_prefix,
        )
        out[field] = new_val
        if ok:
            stats["downloaded"] += 1
        elif is_remote_url(val):
            stats["kept_remote"] += 1

    extra = out.get("extra")
    if isinstance(extra, dict):
        extra_out = dict(extra)
        for key in EXTRA_MEDIA_KEYS:
            if key not in extra_out:
                continue
            val = extra_out[key]
            if isinstance(val, str):
                new_val, ok = localize_url(
                    val, master_id=master_id, field_tag=key.lower(),
                    media_dir=media_dir, rel_prefix=rel_prefix,
                )
                extra_out[key] = new_val
                if ok:
                    stats["downloaded"] += 1
                elif is_remote_url(val):
                    stats["kept_remote"] += 1
        out["extra"] = extra_out

    out["_media_stats"] = stats
    return out


def pick_fields(src: dict, cols: Iterable[str]) -> dict:
    return {k: src.get(k) for k in cols if k in src}


def build_unified_record(master_id: str, posting: dict, detail: dict | None) -> dict:
    """合并主表 + 从表为一张宽表记录，便于单表导入。"""
    rec: dict[str, Any] = {
        "_table": "job_unified",
        "master_id": master_id,
        "_link": {
            "master_id": master_id,
            "parent_table": "job_postings",
            "child_table": "job_posting_details",
            "foreign_key": "master_id",
        },
    }
    rec.update(pick_fields(posting, POSTING_EXPORT_COLS))
    if detail:
        rec.update(pick_fields(detail, DETAIL_EXPORT_COLS))
    return rec


def split_unified_record(rec: dict) -> tuple[dict, dict]:
    """从宽表拆回 posting + detail。"""
    posting = pick_fields(rec, POSTING_EXPORT_COLS)
    posting["source_name"] = rec.get("source_name")
    posting["source_id"] = rec.get("source_id")
    posting["source_id_hash"] = rec.get("source_id_hash")
    detail = pick_fields(rec, DETAIL_EXPORT_COLS)
    return posting, detail


def resolve_media_paths(record: dict, package_dir: Path) -> dict:
    """导入时把相对媒体路径解析为绝对路径（若文件存在）。"""
    out = dict(record)

    def _fix(val: Any) -> Any:
        if not isinstance(val, str) or is_remote_url(val):
            return val
        p = Path(val.replace("/", "\\") if "\\" in val else val)
        if not p.is_absolute():
            candidate = (package_dir / val).resolve()
            if candidate.is_file():
                return str(candidate)
        return val

    for field, _ in MEDIA_FIELD_MAP:
        if field in out:
            out[field] = _fix(out[field])

    extra = out.get("extra")
    if isinstance(extra, dict):
        extra_out = dict(extra)
        for key in EXTRA_MEDIA_KEYS:
            if key in extra_out:
                extra_out[key] = _fix(extra_out[key])
        out["extra"] = extra_out
    return out


def build_meta_header(
    *,
    source: str,
    since: str | None,
    db_count_pre: int,
    media_rel_prefix: str,
    counts: dict,
) -> dict:
    return {
        "_meta": True,
        "schema_version": EXPORT_SCHEMA_VERSION,
        "encoding": "utf-8",
        "source": source,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "since": since,
        "db_count_pre": db_count_pre,
        "master_id_format": "YYYYMM##### (例: 20260900001)",
        "table_relations": TABLE_RELATIONS,
        "media_rel_prefix": media_rel_prefix,
        "counts": counts,
    }
