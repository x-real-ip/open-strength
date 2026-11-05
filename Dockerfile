# ---- Build the PWA ----
FROM node:22-alpine AS web
WORKDIR /app
COPY shared ./shared
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci
COPY web ./web
RUN npm --prefix web run build

# ---- Runtime ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    WEB_DIR=/app/web/dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=web /app/web/dist ./web/dist
# Numeric uid so Kubernetes can verify runAsNonRoot.
USER 1000:1000
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8080/api/ready || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
