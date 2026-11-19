# Tulivu API image for a self-hosted Node deployment (for example Lightsail).
# The client is built separately for static hosting; this image runs the API.
FROM node:24-alpine

WORKDIR /app

# pnpm is not in the base image.
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

# Install dependencies first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile --prod=false

# Copy the rest of the source.
COPY . .

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

CMD ["pnpm", "start"]
