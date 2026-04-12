# Backend Deployment

## 1. Prerequisites

- Docker 24+
- Docker Compose v2
- Node.js 20+ for local non-container runs
- Python 3.11+ for Alembic migrations
- PostgreSQL 16+
- Redis 7+

## 2. Environment Setup

1. Copy the backend example environment:

```bash
cp backend/.env.example backend/.env
```

2. Update the following values before production use:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `POSTGRES_PASSWORD`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `INSTANCE_ID`

## 3. Local Development With Docker Compose

Run from the repository root:

```bash
docker compose up --build
```

This starts:
- `backend`
- `postgres`
- `redis`

Backend will be available at:

```text
http://localhost:3000/api
```

Health endpoint:

```text
http://localhost:3000/api/health
```

## 4. Migrations

Alembic is used for schema migrations from `backend/migrations/versions`.

Manual migration run:

```bash
cd backend
alembic upgrade head
```

Inside Docker, migrations can run automatically on startup when:

```env
RUN_MIGRATIONS=true
```

This is executed by `backend/scripts/start.sh` after PostgreSQL and Redis are reachable.

## 5. Starting Backend Without Docker

```bash
cd backend
npm install
npm run build
alembic upgrade head
node dist/main.js
```

## 6. Seed Bootstrap Data

The backend includes an idempotent local-development seed command.

What gets seeded:
- one default school: `İsü Üniversitesi`
- five departments:
  - `Software Engineering`
  - `Computer Engineering`
  - `Biochemistry`
  - `Business Administration`
  - `Psychology`
- roles:
  - `super_admin`
  - `school_admin`
  - `moderator`
  - `student`
- test users:
  - `admin@isu.local`
  - `moderator@isu.local`
  - `student.software@isu.local`
  - `student.computer@isu.local`
  - `student.biochemistry@isu.local`
- one school-wide general room
- one department room per seeded department
- one sample study group and group room

Default local password for all seeded users:

```text
DevPassword123!
```

Run the seed after migrations:

```bash
cd backend
npm run seed
```

Or run the combined local-dev workflow:

```bash
cd backend
npm run seed:dev
```

Seed behavior is idempotent:
- existing school is reused by slug
- existing departments are reused by `school_id + code`
- existing users are reused by email
- existing general, department, and group rooms are reused
- existing memberships are reactivated instead of duplicated

## 7. Production Deployment Notes

- Use managed PostgreSQL and Redis when possible.
- Keep the application root under `backend/`.
- Provide secrets through environment injection or a secret manager.
- Run behind a reverse proxy or load balancer with TLS termination.
- Use unique `INSTANCE_ID` values for each backend instance.

## 8. Managed Services

Recommended production posture:
- PostgreSQL with backups and PITR
- Redis with persistence and monitoring

## 9. Secrets Handling Notes

- Never commit real secrets.
- Rotate JWT and storage credentials regularly.
- Restrict database and Redis network access to backend runtime only.
