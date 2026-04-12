export interface ValidatedEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  REDIS_HOST: string;
  REDIS_PORT: string;
}

export function validateEnv(env: NodeJS.ProcessEnv): ValidatedEnv {
  const requiredKeys: Array<keyof ValidatedEnv> = [
    'DATABASE_URL',
    'JWT_SECRET',
    'REDIS_HOST',
    'REDIS_PORT',
  ];

  for (const key of requiredKeys) {
    if (!env[key] || String(env[key]).trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return {
    DATABASE_URL: env.DATABASE_URL as string,
    JWT_SECRET: env.JWT_SECRET as string,
    REDIS_HOST: env.REDIS_HOST as string,
    REDIS_PORT: env.REDIS_PORT as string,
  };
}
