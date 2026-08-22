FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm db:generate
RUN pnpm --filter @profitopath/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@profitopath/web", "start"]
