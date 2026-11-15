# Stage 1: build the web app.
FROM node:24-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: run the API with uv on Python 3.12. It serves web/dist, data/clean and data/reference.
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /usr/local/bin/uv
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY backend/ backend/
RUN uv sync --frozen --no-dev
COPY data/clean data/clean
COPY data/reference data/reference
COPY data/agent_cache/README.md data/agent_cache/README.md
COPY --from=web /app/web/dist web/dist
RUN useradd --create-home spark && chown -R spark /app/data/agent_cache
USER spark
# Cloud Run sets PORT. 8080 is the fallback for running the image by hand.
CMD ["sh", "-c", "exec uv run --no-sync uvicorn --factory spark_data.api:create_app --host 0.0.0.0 --port ${PORT:-8080}"]
