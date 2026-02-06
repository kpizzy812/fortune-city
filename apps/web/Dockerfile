# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev libusb-dev
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ---- Build shared ----
FROM deps AS build-shared
COPY packages/shared ./packages/shared
RUN pnpm --filter @fortune-city/shared build

# ---- Build Web ----
FROM build-shared AS build
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_TELEGRAM_BOT_NAME
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TELEGRAM_BOT_NAME=$NEXT_PUBLIC_TELEGRAM_BOT_NAME
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN pnpm --filter @fortune-city/web build

# ---- Production ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
