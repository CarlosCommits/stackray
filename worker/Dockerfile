FROM golang:1.26-bookworm AS httpx-builder

ARG HTTPX_REPO=https://github.com/CarlosCommits/httpx.git
ARG HTTPX_REF=9055739bd2ddb462791189f7e898af58a267c197

RUN git clone --filter=blob:none "${HTTPX_REPO}" /tmp/httpx \
  && cd /tmp/httpx \
  && git fetch --depth 1 origin "${HTTPX_REF}" \
  && git checkout FETCH_HEAD \
  && cd /tmp/httpx/cmd/httpx \
  && go install .

FROM golang:1.25-bookworm AS nuclei-builder

ARG NUCLEI_VERSION=v3.9.0
ARG SUBFINDER_VERSION=v2.14.0
ARG NUCLEI_TEMPLATES_REPO=https://github.com/projectdiscovery/nuclei-templates.git
ARG NUCLEI_TEMPLATES_REF=0174ed4caf6a5d07b32b923bf35bad4b8d0c8d07

RUN go install "github.com/projectdiscovery/nuclei/v3/cmd/nuclei@${NUCLEI_VERSION}"
RUN go install "github.com/projectdiscovery/subfinder/v2/cmd/subfinder@${SUBFINDER_VERSION}"
RUN git clone --filter=blob:none "${NUCLEI_TEMPLATES_REPO}" /opt/nuclei-templates \
  && cd /opt/nuclei-templates \
  && git fetch --depth 1 origin "${NUCLEI_TEMPLATES_REF}" \
  && git checkout FETCH_HEAD \
  && rm -rf /opt/nuclei-templates/.git

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NUCLEI_TEMPLATES_DIR="/opt/nuclei-templates"

RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  gnupg \
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
  wget \
  xauth \
  xvfb \
  && wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux-signing-keyring.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux-signing-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
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
COPY --from=nuclei-builder /go/bin/subfinder /usr/local/bin/subfinder
COPY --from=nuclei-builder /opt/nuclei-templates /opt/nuclei-templates
COPY worker/nuclei-templates /opt/nuclei-templates

CMD ["pnpm", "worker"]
