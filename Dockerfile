FROM oven/bun:1 AS native-dependencies

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./

FROM native-dependencies AS builder

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM node:24-bookworm-slim AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts

RUN node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.prepare('SELECT 1').get(); db.close();"

FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=production-dependencies /app/package-lock.json ./package-lock.json
COPY --from=production-dependencies /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "build/index.js"]
