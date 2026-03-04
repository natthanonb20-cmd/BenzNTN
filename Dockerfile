FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Install dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# Build (generate Prisma client)
FROM deps AS build
COPY prisma ./prisma
RUN npx prisma generate

# Runtime
FROM base AS runner
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY . .

RUN mkdir -p uploads/slips uploads/contracts

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]
