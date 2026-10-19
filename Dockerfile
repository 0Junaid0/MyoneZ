FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend /app
COPY docker-entrypoint.sh /entrypoint.sh

RUN useradd --create-home app \
    && mkdir -p /data \
    && chown -R app:app /app /data \
    && chmod +x /entrypoint.sh
USER root
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "1"]
