# Dependency acquisition only. Test runtime uses an internal Docker network.
FROM node:26.8.1-bookworm AS node-runtime
FROM postgres:17-bookworm
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-17-cron libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
