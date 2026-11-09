# Dependency acquisition only. Test runtime uses an internal Docker network.
FROM node:26.8.1-bookworm AS node-runtime

# Upstream v1.6.4, resolved independently from the official repository. Keep
# the immutable commit and verify checkout; never silently patch old sources.
FROM postgres:17.11-bookworm AS cron-164-builder
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential ca-certificates git postgresql-server-dev-17 libpq-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git init /tmp/pg_cron \
    && git -C /tmp/pg_cron remote add origin https://github.com/citusdata/pg_cron.git \
    && git -C /tmp/pg_cron fetch --depth=1 origin 9490f9cc9803f75105f2f7d89839a998f011f8d8 \
    && git -C /tmp/pg_cron checkout --detach FETCH_HEAD \
    && test "$(git -C /tmp/pg_cron rev-parse HEAD)" = 9490f9cc9803f75105f2f7d89839a998f011f8d8 \
    && make -C /tmp/pg_cron PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config \
    && make -C /tmp/pg_cron PG_CONFIG=/usr/lib/postgresql/17/bin/pg_config DESTDIR=/extension install

FROM postgres:17.11-bookworm AS runtime
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 libatomic1 \
    && rm -rf /var/lib/apt/lists/*
RUN node --version && postgres --version | grep -F 'PostgreSQL) 17.11'

FROM runtime AS upstream-1-6-4
COPY --from=cron-164-builder /extension/usr/lib/postgresql/17/ /usr/lib/postgresql/17/
COPY --from=cron-164-builder /extension/usr/share/postgresql/17/extension/ /usr/share/postgresql/17/extension/
RUN printf '%s\n' 'upstream v1.6.4 commit 9490f9cc9803f75105f2f7d89839a998f011f8d8; SQL extversion 1.6' > /usr/local/share/hq-cron-build.txt

# Preserve the package-provider comparison in addition to the exact old source.
FROM runtime AS packaged
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-17-cron \
    && dpkg-query -W postgresql-17-cron > /usr/local/share/hq-cron-build.txt \
    && rm -rf /var/lib/apt/lists/* \
    && postgres --version | grep -F 'PostgreSQL) 17.11'
