# Build context: backend/ (the monorepo root), so the shared lib and lockfile are available.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs
RUN npx nest build auth

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist/apps/auth ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
