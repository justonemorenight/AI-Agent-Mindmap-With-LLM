# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy configuration files
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY .env.production ./
COPY next.config.ts ./
COPY postcss.config.mjs ./
COPY tailwind.config.ts ./
COPY components.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src ./src
COPY public ./public

# Build application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy pnpm from builder stage
COPY --from=builder /usr/local/lib/node_modules/pnpm /usr/local/lib/node_modules/pnpm
RUN ln -s /usr/local/lib/node_modules/pnpm/bin/pnpm.cjs /usr/local/bin/pnpm

# Set production environment
ENV NODE_ENV=production

# Copy necessary files from build stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Expose Next.js default port
EXPOSE 3000

# Start application
CMD ["pnpm", "run", "start"]
