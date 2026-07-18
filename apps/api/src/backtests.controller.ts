import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  BacktestRunService,
  type JsonObject,
} from '@quant-lab/simulation';

import { BACKTESTS } from './tokens';

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

@Controller('backtests')
export class BacktestsController {
  constructor(
    @Inject(BACKTESTS) private readonly backtests: BacktestRunService,
  ) {}

  @Post('experiments')
  createExperiment(@Body() body: ExperimentBody) {
    try {
      return this.backtests.createExperiment(
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
  queue(@Body() body: RunBody) {
    if (!body.experimentId || !body.datasetId)
      throw new BadRequestException('experimentId and datasetId are required');
    try {
      return this.backtests.queue({
        experimentId: body.experimentId,
        datasetId: body.datasetId,
        seed: body.seed ?? 1,
        codeCommit: body.codeCommit ?? '',
        configuration: body.configuration ?? {},
        modelVersions: body.modelVersions ?? { replay: '1.0.0' },
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
    return this.backtests.inspect(id);
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
