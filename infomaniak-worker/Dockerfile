FROM denoland/deno:bin-2.6.3 AS deno
FROM python:3.13-slim
COPY --from=deno /deno /usr/local/bin/deno
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "yt-dlp[default]>=2025.1.1" "requests>=2.32,<3"
WORKDIR /app
COPY worker.py .
RUN useradd --create-home --uid 10001 worker && mkdir -p /work && chown worker:worker /work
USER worker
CMD ["python", "-u", "worker.py"]
