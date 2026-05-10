FROM node:20-alpine AS deps

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build

WORKDIR /app/backend

COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache bash python3 py3-pip netcat-openbsd curl

COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./dist
COPY backend ./backend
WORKDIR /app
COPY scripts ./scripts

RUN chmod +x ./scripts/start.sh ./scripts/wait-for-services.sh \
    && pip install --no-cache-dir -r ./backend/requirements.txt

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["./scripts/start.sh"]
