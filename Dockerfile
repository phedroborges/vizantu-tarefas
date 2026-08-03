# Build multi-stage do Vizantu Tarefas para deploy em VPS (EasyPanel) — usa a
# saída "standalone" do Next.js, então a imagem final não carrega node_modules
# inteiro nem o código-fonte, só o server bundlado.

FROM node:22-slim AS base
RUN corepack enable

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------- runtime ----------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
ENV PORT=31111
ENV HOSTNAME="0.0.0.0"
EXPOSE 31111

CMD ["node", "server.js"]
