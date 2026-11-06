# Сборка «Цифрового деканата» для сервера.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq openssl >/dev/null && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# tools: полный исходник + dev-зависимости — для миграций, seed и импорта (разовые команды)
FROM deps AS tools
COPY . .
RUN npx prisma generate

FROM tools AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# runner: только standalone-сборка, без исходников и dev-зависимостей
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq openssl >/dev/null && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
