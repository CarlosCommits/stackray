FROM golang:1.25-bookworm AS httpx-builder

RUN go install github.com/projectdiscovery/httpx/cmd/httpx@latest

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY drizzle ./drizzle
COPY lib/env ./lib/env
COPY lib/server/scans ./lib/server/scans
COPY worker ./worker

COPY --from=httpx-builder /go/bin/httpx /usr/local/bin/httpx

CMD ["pnpm", "worker"]
