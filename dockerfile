FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

# Código
COPY . .

RUN bun run build


FROM oven/bun:1-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

RUN bun install --production --frozen-lockfile

EXPOSE 3000

CMD ["bun", "build/index.js"]