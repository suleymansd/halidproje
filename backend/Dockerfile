FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip postgresql-client curl netcat-openbsd
RUN python3 -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

COPY package.json ./
RUN npm install

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY migrations ./migrations
COPY alembic.ini requirements.txt ./
COPY scripts ./scripts

RUN chmod +x ./scripts/start.sh ./scripts/wait-for-services.sh \
    && npm run build \
    && pip install --no-cache-dir -r requirements.txt

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["./scripts/start.sh"]

