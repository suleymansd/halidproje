import 'dotenv/config';

import { Pool } from 'pg';

import { SeedService } from './seed.service';

function resolveDatabaseUrl(): string {
  const databaseUrl = process.env.SEED_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or SEED_DATABASE_URL is required');
  }

  const parsed = new URL(databaseUrl);
  if (parsed.hostname === 'postgres') {
    if (process.env.SEED_DB_HOST) {
      parsed.hostname = process.env.SEED_DB_HOST;
      if (process.env.SEED_DB_PORT) {
        parsed.port = process.env.SEED_DB_PORT;
      }
    } else if (process.platform === 'win32') {
      parsed.hostname = 'localhost';
      parsed.port = process.env.POSTGRES_HOST_PORT ?? '5434';
    }
  }

  return parsed.toString();
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(),
  });

  try {
    const seedService = new SeedService(pool);
    await seedService.seed();

    const summary = seedService.getSeedSummary();
    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'ok',
          seededSchool: summary.school,
          defaultPassword: summary.password,
          users: summary.users,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };

  process.stderr.write(
    `${JSON.stringify(
      {
        status: 'error',
        error: message,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
});
