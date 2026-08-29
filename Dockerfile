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

FROM native-dependencies AS production-dependencies

RUN bun install --production --frozen-lockfile

FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=production-dependencies /app/node_modules ./node_modules

EXPOSE 3000

CMD ["bun", "build/index.js"]
