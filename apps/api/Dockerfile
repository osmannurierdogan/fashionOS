# Railway için API imajı. Derleme bağlamı: depo kökü.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @fashionos/api --workspace @fashionos/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @fashionos/api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @fashionos/api --include-workspace-root && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
EXPOSE 4000
USER node
CMD ["node", "apps/api/dist/index.js"]
