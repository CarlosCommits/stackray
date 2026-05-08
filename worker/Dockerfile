FROM golang:1.26-bookworm AS httpx-builder

ARG HTTPX_REPO=https://github.com/CarlosCommits/httpx.git
ARG HTTPX_REF=359eccb0eec8f18ea83c73f91a3811b5d6abd10e

ADD https://api.github.com/repos/CarlosCommits/httpx/git/commits/359eccb0eec8f18ea83c73f91a3811b5d6abd10e /tmp/httpx-ref.json
RUN git clone --filter=blob:none "${HTTPX_REPO}" /tmp/httpx \
  && cd /tmp/httpx \
  && git fetch --depth 1 origin "${HTTPX_REF}" \
  && git checkout FETCH_HEAD \
  && cd /tmp/httpx/cmd/httpx \
  && go install .

FROM golang:1.25-bookworm AS nuclei-builder

ARG NUCLEI_VERSION=v3.8.0
ARG NUCLEI_TEMPLATES_REPO=https://github.com/projectdiscovery/nuclei-templates.git
ARG NUCLEI_TEMPLATES_REF=f58bfb3046c7ef57dbea4ba0fb3c9be6d58db307

ADD https://api.github.com/repos/projectdiscovery/nuclei/releases/tags/v3.8.0 /tmp/nuclei-release.json
RUN go install "github.com/projectdiscovery/nuclei/v3/cmd/nuclei@${NUCLEI_VERSION}"
ADD https://api.github.com/repos/projectdiscovery/nuclei-templates/git/commits/f58bfb3046c7ef57dbea4ba0fb3c9be6d58db307 /tmp/nuclei-templates-ref.json
RUN git clone --filter=blob:none "${NUCLEI_TEMPLATES_REPO}" /opt/nuclei-templates \
  && cd /opt/nuclei-templates \
  && git fetch --depth 1 origin "${NUCLEI_TEMPLATES_REF}" \
  && git checkout FETCH_HEAD \
  && rm -rf /opt/nuclei-templates/.git

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
COPY lib/server/jobs ./lib/server/jobs
COPY lib/server/scans ./lib/server/scans
COPY lib/server/schedules ./lib/server/schedules
COPY lib/server/storage ./lib/server/storage
COPY worker ./worker

COPY --from=httpx-builder /go/bin/httpx /usr/local/bin/httpx
COPY --from=nuclei-builder /go/bin/nuclei /usr/local/bin/nuclei
COPY --from=nuclei-builder /opt/nuclei-templates /opt/nuclei-templates
COPY worker/nuclei-templates /opt/nuclei-templates

CMD ["pnpm", "worker"]
