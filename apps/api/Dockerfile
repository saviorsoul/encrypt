FROM node:24-alpine

# Env: not copied into the image. Compose injects env_file (.env.docker),
# sets DATABASE_URL, and mounts .env.docker → /app/.env for loadEnv.

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/core/package.json ./packages/core/
COPY packages/schemas/package.json ./packages/schemas/

RUN npm ci -w @encrypt/api -w @encrypt/core -w @encrypt/schemas --include-workspace-root --ignore-scripts

# Fail the build if npm deps are missing (catches MODULE_NOT_FOUND before runtime).
RUN node --input-type=module -e "import 'dotenv'; import 'koa'"

COPY packages/core ./packages/core
COPY packages/schemas ./packages/schemas
COPY apps/api ./apps/api

RUN npx tsx -e "import '@encrypt/schemas'"

WORKDIR /app/apps/api
RUN npx prisma generate

WORKDIR /app

EXPOSE 3000

CMD ["npm", "run", "dev:docker", "-w", "@encrypt/api"]
