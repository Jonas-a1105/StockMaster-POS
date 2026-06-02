# Stage 1: Build NestJS Application
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependencias necesarias para compilar Prisma nativo
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .

# Genera el cliente Prisma
RUN npx prisma generate

# Compila el backend NestJS a JavaScript de producción
RUN npm run build

# Elimina dependencias de desarrollo
RUN npm prune --production

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Ejecuta migraciones antes de iniciar el servidor en producción
CMD ["sh", "-c", "npx prisma db push && node dist/main"]
