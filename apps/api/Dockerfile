FROM node:24-alpine

# Env: not copied into the image. Compose injects env_file (.env.docker),
# sets DATABASE_URL, and mounts .env.docker → /app/.env for loadEnv.

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm ci -w @encrypt/api --include-workspace-root

COPY apps/api ./apps/api

EXPOSE 3000

CMD ["npm", "run", "dev", "-w", "@encrypt/api"]
