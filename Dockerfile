FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json README.md .env.example ./
COPY src ./src
RUN pnpm exec tsc -p tsconfig.json

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
