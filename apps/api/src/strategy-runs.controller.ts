import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';

import { STRATEGY_RUNS } from './tokens';
import { StrategyRunsService } from './strategy-runs.service';

@Controller('strategy-runs')
export class StrategyRunsController {
  constructor(
    @Inject(STRATEGY_RUNS) private readonly service: StrategyRunsService,
  ) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post('versions')
  publish(@Body() body: Parameters<StrategyRunsService['publish']>[0]) {
    return this.service.publish(body);
  }

  @Post('parameter-sets')
  parameters(
    @Body() body: Parameters<StrategyRunsService['createParameterSet']>[0],
  ) {
    return this.service.createParameterSet(body);
  }

  @Post()
  schedule(@Body() body: Parameters<StrategyRunsService['schedule']>[0]) {
    return this.service.schedule(body);
  }

  @Post(':id/:action')
  transition(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: { reason?: string },
  ) {
    const target: Record<string, string> = {
      start: 'running',
      pause: 'paused',
      resume: 'running',
      complete: 'completed',
      fail: 'failed',
      cancel: 'cancelled',
      retry: 'scheduled',
    };
    if (!target[action]) throw new TypeError('unknown strategy run action');
    return this.service.transition(
      id,
      target[action],
      body.reason ?? `operator_${action}`,
    );
  }
}
