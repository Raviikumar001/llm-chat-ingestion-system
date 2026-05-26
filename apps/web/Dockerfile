FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9.1.0

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./

# Copy package files
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.js ./apps/web/
COPY apps/web/postcss.config.js ./apps/web/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY apps/web/src ./apps/web/src
COPY packages/shared/src ./packages/shared/src

EXPOSE 3000

CMD ["pnpm", "--filter", "@ollive/web", "dev"]
