import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DatabaseLifecycle } from '@quant-lab/database';
import type { ApplicationMetrics } from '@quant-lab/shared';

import { DATABASE, METRICS } from './tokens';

interface HealthResponse {
  status: 'ok';
  time: string;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseLifecycle,
    @Inject(METRICS) private readonly metrics: ApplicationMetrics,
  ) {}

  @Get('live')
  live(): HealthResponse {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    if (await this.database.probe()) {
      this.metrics.databaseReady.set(1);
      return { status: 'ok', time: new Date().toISOString() };
    }

    this.metrics.databaseReady.set(0);
    throw new ServiceUnavailableException('Database is unavailable');
  }
}
