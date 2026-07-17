import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { ApplicationMetrics } from '@quant-lab/shared';

import { METRICS } from './tokens';

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(METRICS) private readonly metrics: ApplicationMetrics) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async read(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
