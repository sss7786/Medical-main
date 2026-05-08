# ── 阶段1：前端构建 ──────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖文件
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 复制源码并构建
COPY . .
RUN pnpm run build

# ── 阶段2：后端运行时 ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS backend

WORKDIR /app/server

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 后端源码
COPY server/ .

# 从前端构建阶段复制产物
COPY --from=frontend-builder /app/dist /app/server/static

# 数据目录
RUN mkdir -p data/memory

# 让 FastAPI 同时提供前端静态文件
RUN pip install --no-cache-dir aiofiles

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
