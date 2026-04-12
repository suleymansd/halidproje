FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache bash python3 py3-pip netcat-openbsd curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/backend ./backend
COPY --from=build /app/scripts ./scripts

RUN chmod +x ./scripts/start.sh ./scripts/wait-for-services.sh \
    && pip install --no-cache-dir -r ./backend/requirements.txt

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["./scripts/start.sh"]
