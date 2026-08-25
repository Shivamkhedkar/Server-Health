FROM python:3.10-slim

WORKDIR /app

# Install system dependencies. curl is required by the HEALTHCHECK below -
# python:3.10-slim does not include it by default, so without this line
# the healthcheck silently and permanently reports "unhealthy"
# (`curl: not found`) even when the app itself is fine.
RUN apt-get update && apt-get install -y --no-install-recommends     gcc     libpq-dev     curl     && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user execution
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=3   CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
