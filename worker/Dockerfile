FROM golang:1.25-bookworm AS httpx-builder

RUN go install github.com/projectdiscovery/httpx/cmd/httpx@latest

FROM golang:1.25-bookworm AS nuclei-builder

RUN go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
RUN /go/bin/nuclei -update-templates -ud /opt/nuclei-templates

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NUCLEI_TEMPLATES_DIR="/opt/nuclei-templates"

RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpangocairo-1.0-0 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY drizzle ./drizzle
COPY lib/env ./lib/env
COPY lib/server/scans ./lib/server/scans
COPY lib/server/storage ./lib/server/storage
COPY worker ./worker

COPY --from=httpx-builder /go/bin/httpx /usr/local/bin/httpx
COPY --from=nuclei-builder /go/bin/nuclei /usr/local/bin/nuclei
COPY --from=nuclei-builder /opt/nuclei-templates /opt/nuclei-templates
COPY worker/nuclei-templates /opt/nuclei-templates

CMD ["pnpm", "worker"]
