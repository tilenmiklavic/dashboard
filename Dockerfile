FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Debian 13 (trixie), the same release as the server, so its journalctl reads the host's journal files (SSH logs).
FROM node:24-trixie-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends systemd \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src/server ./src/server
COPY apps.config.json ./
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "src/server/index.ts"]
