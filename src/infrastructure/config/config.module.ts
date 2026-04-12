import { Global, Module } from '@nestjs/common';

import { validateEnv } from './env.validation';

@Global()
@Module({})
export class ConfigModule {}

validateEnv(process.env);
