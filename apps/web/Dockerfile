# ============================================================================
# ChefCloud Web Dockerfile
# Multi-stage build for Next.js production deployment
# ============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base with dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install libc6-compat for Alpine compatibility
RUN apk add --no-cache libc6-compat

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Dependencies installer
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy workspace config files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Builder
# -----------------------------------------------------------------------------
FROM deps AS builder

# Build-time environment variables
# NEXT_PUBLIC_* vars must be set at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_APP_VERSION=docker

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION}

# Copy source code
COPY apps/web/ ./apps/web/

WORKDIR /app/apps/web

# Build Next.js application
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 4: Production runner
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built output
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.js ./apps/web/

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

WORKDIR /app/apps/web

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check (Next.js serves static pages)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start command (use pnpm start which runs next start)
CMD ["pnpm", "start"]
