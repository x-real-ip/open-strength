# One image: Fastify serves both the API and the built PWA.

# --- Build the PWA ---
FROM docker.io/library/node:22-alpine AS web
WORKDIR /app
COPY shared ./shared
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci
COPY web ./web
RUN npm --prefix web run build

# --- Runtime ---
FROM docker.io/library/node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    WEB_DIR=/app/web/dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Node runs the TypeScript sources directly (type stripping), so there is no server build step.
COPY server ./server
COPY shared ./shared
COPY --from=web /app/web/dist ./web/dist

# Own non-root user; the same uid/gid is set in the deployment's securityContext.
RUN addgroup -g 3001 overload && adduser -u 3001 -G overload -S -H overload
USER 3001:3001

EXPOSE 8080
# Migrations run from this image too: node --disable-warning=ExperimentalWarning server/migrate.ts
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
