FROM node:24-alpine

# Env: not copied into the image. Compose injects env_file (.env.docker)
# and mounts .env.docker → /app/.env so Vite envDir (repo root) can read VITE_*.

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/feed-lab/package.json ./apps/feed-lab/
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY packages/platform/package.json ./packages/platform/
COPY packages/csp/package.json ./packages/csp/
COPY apps/web/package.json ./apps/web/

RUN npm ci -w @encrypt/feed-lab --include-workspace-root --ignore-scripts

COPY packages/core ./packages/core
COPY packages/ui ./packages/ui
COPY packages/platform ./packages/platform
COPY packages/csp ./packages/csp
COPY apps/feed-lab ./apps/feed-lab
COPY apps/web/src ./apps/web/src

EXPOSE 5174

CMD ["npm", "run", "dev", "-w", "@encrypt/feed-lab", "--", "--host", "0.0.0.0"]
