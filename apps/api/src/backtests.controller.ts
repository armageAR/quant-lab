import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BacktestAnalyticsService } from '@quant-lab/analytics';
import { BacktestRunService, type JsonObject } from '@quant-lab/simulation';

import { BACKTEST_ANALYTICS, BACKTESTS } from './tokens';

interface ExperimentBody {
  name?: string;
  hypothesis?: string;
}

interface RunBody {
  experimentId?: string;
  datasetId?: string;
  seed?: number;
  codeCommit?: string;
  configuration?: JsonObject;
  modelVersions?: Record<string, string>;
}

interface SweepBody extends Omit<RunBody, 'configuration'> {
  configurations?: JsonObject[];
}

@Controller('backtests')
export class BacktestsController {
  constructor(
    @Inject(BACKTESTS) private readonly backtests: BacktestRunService,
    @Inject(BACKTEST_ANALYTICS)
    private readonly analytics: BacktestAnalyticsService,
  ) {}

  @Post('experiments')
  async createExperiment(@Body() body: ExperimentBody) {
    try {
      return await this.backtests.createExperiment(
        body.name ?? '',
        body.hypothesis ?? '',
      );
    } catch (error) {
      throw this.badRequest(error);
    }
  }

  @Get('experiments')
  experiments() {
    return this.backtests.listExperiments();
  }

  @Post('runs')
  async queue(@Body() body: RunBody) {
    if (!body.experimentId || !body.datasetId)
      throw new BadRequestException('experimentId and datasetId are required');
    try {
      return await this.backtests.queue({
        experimentId: body.experimentId,
        datasetId: body.datasetId,
        seed: body.seed ?? 1,
        codeCommit: body.codeCommit ?? '',
        configuration: body.configuration ?? {},
        modelVersions: body.modelVersions ?? {
          replay: '1.0.0',
          fill: 'fill-v1',
          fees: '1.0.0',
          slippage: '1.0.0',
          latency: '1.0.0',
          rebalancing: '1.0.0',
        },
      });
    } catch (error) {
      throw this.badRequest(error);
    }
  }

  @Get('runs')
  runs(@Query('experimentId') experimentId?: string) {
    return this.backtests.list(experimentId);
  }

  @Get('runs/:id')
  run(@Param('id') id: string) {
    return this.analytics.inspect(id);
  }

  @Get('runs/:id/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="backtest-run.csv"')
  csv(@Param('id') id: string) {
    return this.analytics.csv(id);
  }

  @Get('compare')
  compare(@Query('ids') ids?: string) {
    return this.analytics
      .compare(
        (ids ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
      .catch((error: unknown) => {
        throw this.badRequest(error);
      });
  }

  @Post('sweeps')
  sweep(@Body() body: SweepBody) {
    if (!body.experimentId || !body.datasetId)
      throw new BadRequestException('experimentId and datasetId are required');
    return this.analytics
      .sweep(
        {
          experimentId: body.experimentId,
          datasetId: body.datasetId,
          seed: body.seed ?? 1,
          codeCommit: body.codeCommit ?? '',
          modelVersions: body.modelVersions ?? {
            replay: '1.0.0',
            fill: 'fill-v1',
            fees: '1.0.0',
            slippage: '1.0.0',
            latency: '1.0.0',
            rebalancing: '1.0.0',
          },
        },
        body.configurations ?? [],
      )
      .catch((error: unknown) => {
        throw this.badRequest(error);
      });
  }

  @Post('runs/:id/pause')
  pause(@Param('id') id: string) {
    return this.backtests.pause(id).catch((error: unknown) => {
      throw this.badRequest(error);
    });
  }

  @Post('runs/:id/resume')
  resume(@Param('id') id: string) {
    return this.backtests.resume(id).catch((error: unknown) => {
      throw this.badRequest(error);
    });
  }

  @Post('runs/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.backtests.cancel(id).catch((error: unknown) => {
      throw this.badRequest(error);
    });
  }

  private badRequest(error: unknown): BadRequestException {
    return new BadRequestException(
      error instanceof Error ? error.message : 'invalid backtest request',
    );
  }
}
