# 后端 API 镜像（ECS：经 host.docker.internal 连宿主机 Postgres）
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
    PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn

# 依赖均为 manylinux wheel（含 psycopg[binary]），无需 apt 编译工具链
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt

COPY backend /app/backend
# knowledge.cleaner 复用 crawler.parser（运行时依赖，非爬虫服务）
COPY crawler /app/crawler

ENV PYTHONPATH=/app

EXPOSE 5000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "5000"]
