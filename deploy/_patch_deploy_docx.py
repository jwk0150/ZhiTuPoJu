# -*- coding: utf-8 -*-
"""微改正文：对齐执图破局 ECS Docker 实际部署，并补充测试账号。"""
from copy import deepcopy
from docx import Document
from docx.oxml.ns import qn
from pathlib import Path

SRC = Path(r"C:\Users\Ibiza\Desktop\部署说明.docx")
DST = Path(r"C:\Users\Ibiza\Desktop\部署说明_执图破局.docx")

# index -> new text (None = keep)
REPLACEMENTS = {
    0: "系统部署说明",
    1: "1.部署方案概述",
    2: (
        "本系统为执图破局人岗智能匹配平台，面向数字人才地图、岗位洞察、新岗位发现、"
        "人岗匹配与智能问答等核心能力。为保障可复现、可运维与快速验收，项目采用 "
        "Docker Compose 容器化部署：应用层（前端 nginx + 后端 FastAPI）容器化；"
        "业务数据库继续使用阿里云 ECS 宿主机上的 PostgreSQL（不另起数据库容器）。"
        "支持云端公网正式访问，以及本机经 SSH 隧道连接云库的开发复现。"
    ),
    3: (
        "系统采用前后端分离架构。云端正式部署时，前端静态站点与后端 API 由 Compose 统一编排；"
        "PostgreSQL 运行于宿主机本机端口，容器通过 host.docker.internal 访问。"
        "用户账号持久化挂载于 backend/data。公网统一入口为 80 端口，API 经 nginx 反代 /api/。"
    ),
    4: "2.部署环境要求",
    5: "2.1硬件环境",
    6: "本次云端部署基于阿里云 ECS 服务器（示例公网 IP：8.148.77.88），硬件建议如下：",
    7: "CPU：4核及以上",
    8: "内存：8GB及以上（演示与地图检索足够；更高配置更利于并发与大模型调用）",
    9: "磁盘：40GB及以上 SSD，用于镜像、静态资源与账号数据持久化",
    10: "网络：公网 IP，安全组放行 TCP 80（数据库 5432 仅本机/Docker 网段，不对公网开放）",
    11: "2.2软件环境",
    12: "云端操作系统：Ubuntu 22.04（或兼容的 Linux）；本机开发可用 Windows 10/11",
    13: "容器环境：Docker 24.0+、Docker Compose V2",
    14: "数据库：宿主机 PostgreSQL 14+（本项目云库为 zhitu_crawl_db，地图表 map_data_table）",
    15: "可选：本机开发时使用 SSH 隧道将云库映射到本机 5433",
    16: "运行环境：容器内 Python 3.12（后端镜像）；前端为静态资源，无需 Node 运行时",
    17: "3.阿里云 ECS 云端 Docker Compose 部署流程",
    18: "3.1服务器环境初始化",
    19: "远程连接阿里云 ECS，安装 Docker（官方脚本或发行版软件源均可），并配置国内镜像加速以便拉取基础镜像：",
    20: (
        "curl -fsSL https://get.docker.com | sh\n"
        "systemctl enable --now docker\n"
        "# 建议配置 registry-mirrors（如 DaoCloud / 腾讯云镜像），避免 Docker Hub 超时"
    ),
    21: "3.2项目代码部署",
    22: "在服务器建立部署目录（当前正式目录为 /opt/zhitu），同步项目代码并保留 .env：",
    23: (
        "mkdir -p /opt/zhitu\n"
        "# 将仓库同步至 /opt/zhitu（git pull 或上传打包包均可）\n"
        "cd /opt/zhitu\n"
        "mkdir -p backend/data"
    ),
    24: "3.3环境变量配置",
    25: "复制环境变量模板并配置数据库口令、JWT 密钥、大模型密钥等：",
    26: "cp .env.example .env\nvim .env",
    27: (
        "关键配置项：PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DB、JWT_SECRET、DEEPSEEK_API_KEY 等。"
        "云端 Compose（docker-compose.server.yml）会覆盖 PG_HOST=host.docker.internal、PG_PORT=5432，"
        "使容器访问宿主机 Postgres；勿将数据库端口暴露到公网。"
    ),
    28: "3.4容器服务启动",
    29: (
        "使用服务器专用 Compose 文件一键构建并启动前端与后端。"
        "启动前请确认宿主机 Postgres 已运行，且已允许 Docker 网段访问（listen_addresses 含 172.17.0.1，"
        "pg_hba 放行 172.16.0.0/12）。原宿主机 nginx / uvicorn 服务需停用，以免占用 80 端口："
    ),
    30: (
        "systemctl stop nginx zhitu.service 2>/dev/null || true\n"
        "export DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0\n"
        "docker compose -f docker-compose.server.yml -p zhitu up -d --build"
    ),
    31: "启动完成后查看容器状态，并验证健康检查与地图接口：",
    32: (
        "docker compose -f docker-compose.server.yml -p zhitu ps\n"
        "curl -fsS http://127.0.0.1/api/health\n"
        "curl -fsS http://127.0.0.1/api/map/provinces | head"
    ),
    33: "3.5访问入口与数据说明",
    34: (
        "公网访问地址：http://8.148.77.88/ （前端 80；后端不单独对公网暴露，经 /api/ 反代）。"
        "业务库与岗位地图数据已在宿主机 PostgreSQL 中维护；账号文件持久化于 backend/data。"
        "后端启动时会自动写入缺失的默认演示账号，无需手工建用户表。"
    ),
    35: (
        "登录系统后可使用数字人才地图、岗位洞察、新岗位发现、人岗匹配与个人中心等功能。"
        "普通用户支持自助注册；管理员不可自助注册。"
    ),
    36: "4.测试账号说明",
    37: (
        "系统预置两类测试账号（密码区分大小写）：\n"
        "1）管理员：用户名 shangshanruoshui，密码 ssrs123（进入内部运营端）。\n"
        "2）普通用户：用户名 user，密码 user123（进入岗位大新闻与业务功能页）。\n"
        "亦可在登录页「普通用户」页签点击注册，自行创建普通用户账号。"
    ),
}

# append new sections after rewriting 36-37 — we also need section 5 部署保障
EXTRA = [
    ("Heading 1", "5.部署保障说明"),
    (
        "Normal",
        "应用层采用容器化隔离；账号数据通过卷挂载持久化，重启容器不丢失注册用户。"
        "数据库位于宿主机，与 Compose 生命周期解耦，便于备份与验收复现。"
        "本机开发可继续使用 start_db_tunnel.cmd + docker-compose.yml（隧道 5433）或 start_all.cmd。"
        "上述方案满足赛事对可访问性、可复现性与运维可操作性的验收要求。",
    ),
]


def set_para_text(paragraph, text: str) -> None:
    """Replace paragraph text while keeping the first run's basic formatting."""
    if not paragraph.runs:
        paragraph.add_run(text)
        return
    # clear all but first run
    for run in paragraph.runs[1:]:
        run._element.getparent().remove(run._element)
    paragraph.runs[0].text = text


def main() -> None:
    doc = Document(str(SRC))
    for idx, text in REPLACEMENTS.items():
        if idx >= len(doc.paragraphs):
            raise SystemExit(f"missing paragraph {idx}")
        set_para_text(doc.paragraphs[idx], text)

    # Add section 5 if not already present as heading after rewrite
    # After edit, para 36 is "4.测试账号", 37 is account body — append 5.
    last = doc.paragraphs[-1]
    # only append if we don't already have section 5
    body_texts = [p.text for p in doc.paragraphs]
    if not any(t.startswith("5.") for t in body_texts):
        for style, text in EXTRA:
            p = doc.add_paragraph(text)
            try:
                p.style = style
            except KeyError:
                pass

    doc.save(str(DST))
    print("saved", DST)


if __name__ == "__main__":
    main()
