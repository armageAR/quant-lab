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
  PaperTradingService,
  type PaperRiskLimits,
} from '@quant-lab/paper-trading';

import { PAPER_TRADING } from './tokens';

interface SessionBody {
  name?: string;
  strategyVersion?: string;
  codeCommit?: string;
  initialBalances?: Record<string, Record<string, string>>;
  limits?: PaperRiskLimits;
}

@Controller('paper-trading')
export class PaperTradingController {
  constructor(
    @Inject(PAPER_TRADING) private readonly paper: PaperTradingService,
  ) {}

  @Get('sessions') sessions() {
    return this.paper.listSessions();
  }
  @Get('sessions/:id') session(@Param('id') id: string) {
    return this.paper.inspect(id);
  }
  @Post('sessions') create(@Body() body: SessionBody) {
    if (!body.initialBalances || !body.limits)
      throw new BadRequestException('initialBalances and limits are required');
    return this.wrap(() =>
      this.paper.createSession({
        name: body.name ?? '',
        strategyVersion: body.strategyVersion ?? '',
        codeCommit: body.codeCommit ?? '',
        configuration: {
          initialBalances: body.initialBalances!,
          limits: body.limits!,
        },
      }),
    );
  }
  @Post('sessions/:id/:action') control(
    @Param('id') id: string,
    @Param('action') action: string,
  ) {
    if (!['start', 'pause', 'stop', 'emergency-stop'].includes(action))
      throw new BadRequestException('unsupported paper session action');
    return this.wrap(() =>
      this.paper.control(
        id,
        action as 'start' | 'pause' | 'stop' | 'emergency-stop',
      ),
    );
  }
  @Post('sessions/:id/opportunities/:opportunityId') execute(
    @Param('id') id: string,
    @Param('opportunityId') opportunityId: string,
  ) {
    return this.wrap(() => this.paper.executeOpportunity(id, opportunityId));
  }
  @Post('sessions/:id/campaigns') campaign(
    @Param('id') sessionId: string,
    @Body()
    body: {
      name?: string;
      minimumDurationHours?: number;
      minimumSampleCount?: number;
    },
  ) {
    return this.wrap(() =>
      this.paper.startCampaign(sessionId, {
        name: body.name ?? '',
        minimumDurationHours: body.minimumDurationHours ?? 0,
        minimumSampleCount: body.minimumSampleCount ?? 0,
      }),
    );
  }
  @Get('campaigns/:id/report') report(
    @Param('id') id: string,
    @Query('finalize') finalize?: string,
  ) {
    return this.wrap(() => this.paper.campaignReport(id, finalize === 'true'));
  }
  private async wrap<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'invalid paper trading request',
      );
    }
  }
}
