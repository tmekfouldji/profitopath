FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm db:generate
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    MOCK_PAYMENT_SIGNING_SECRET=build-only-mock-payment-signing-secret \
    NEXTAUTH_SECRET=build-only-nextauth-secret-at-least-thirty-two-characters \
    NEXTAUTH_URL=http://localhost:3000 \
    VALKEY_URL=redis://localhost:6379 \
    pnpm --filter @profitopath/web build
RUN prisma_engine="$(find node_modules/.pnpm -type f -path '*/node_modules/.prisma/client/libquery_engine-*.so.node' -print -quit)" \
    && test -n "$prisma_engine" \
    && mkdir -p apps/web/.next/standalone/apps/web/.next \
    && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
    && cp "$prisma_engine" apps/web/.next/standalone/apps/web/.next/server/

EXPOSE 3000
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node apps/web/.next/standalone/apps/web/server.js"]
