ARG BASE_IMAGE=node:24.18.1-alpine

FROM ${BASE_IMAGE} AS deps
WORKDIR /app
RUN npm install -g pnpm@11.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM ${BASE_IMAGE} AS prod-deps
WORKDIR /app
RUN npm install -g pnpm@11.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM ${BASE_IMAGE} AS build
WORKDIR /app
RUN npm install -g pnpm@11.18.0
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM ${BASE_IMAGE} AS migrator
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json database.json ./
COPY migrations ./migrations
USER 1000
CMD ["node", "node_modules/db-migrate/bin/db-migrate", "up", "-e", "prod"]

FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER 1000
EXPOSE 3000
CMD ["node", "server.js"]
