FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9.1.0

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY .gitignore ./

# Copy package files
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/llm-gateway/package.json packages/llm-gateway/tsconfig.json ./packages/llm-gateway/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY apps/api/src ./apps/api/src
COPY apps/api/drizzle.config.ts ./apps/api/
COPY apps/api/drizzle ./apps/api/drizzle
COPY packages/shared/src ./packages/shared/src
COPY packages/llm-gateway/src ./packages/llm-gateway/src

EXPOSE 3001

CMD ["pnpm", "--filter", "@ollive/api", "dev"]
