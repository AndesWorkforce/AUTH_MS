# ============================================================
# Stage 1: Install all deps, build, then prune devDeps
# (single npm install = faster than running two)
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# dumb-init for proper PID 1 / signal handling in containers
RUN apk add --no-cache dumb-init

COPY package.json ./

# Install ALL deps (devDeps needed for tsc / @nestjs/cli)
# --ignore-scripts skips the "prepare" husky hook
RUN npm install --ignore-scripts

# Copy source files needed for compilation
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/
COPY config/ ./config/

# Compile TypeScript → dist/
RUN npm run build

# Remove devDependencies in-place so we can copy a clean node_modules
RUN npm prune --omit=dev --ignore-scripts


# ============================================================
# Stage 2: Lean production image
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

# Binary is already built into Alpine's node image; pull dumb-init from builder
COPY --from=builder /usr/bin/dumb-init /usr/bin/dumb-init

# Production-only node_modules (pruned in Stage 1)
COPY --from=builder /app/node_modules ./node_modules

# Compiled output  (dist/src/ + dist/config/)
COPY --from=builder /app/dist ./dist

# Minimal package metadata (needed by some NestJS internals)
COPY package.json ./

# Run as the built-in non-root 'node' user (uid 1000)
USER node

ENV NODE_ENV=production
ENV PORT=3003
ENV NATS_HOST=72.61.129.234
ENV NATS_PORT=4222
ENV NATS_USERNAME=andes_nats
ENV NATS_PASSWORD=andesworkforce_nats
ENV JWT_SECRET_PASSWORD=andesmetrics
ENV DEV_LOGS=true
ENV ENVIRONMENT=development

EXPOSE 3003

# dumb-init ensures proper PID 1 handling and signal forwarding
# Entry point is dist/src/main (NestJS tsc output: src/ → dist/src/)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]
