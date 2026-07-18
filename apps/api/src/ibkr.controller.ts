import { Controller, Get, Inject, Post } from '@nestjs/common';

import {
  IbkrService,
  type IbkrContractView,
  type IbkrRefreshView,
} from './ibkr.service';
import { IBKR } from './tokens';

@Controller('ibkr')
export class IbkrController {
  constructor(@Inject(IBKR) private readonly service: IbkrService) {}

  @Get('contracts')
  contracts(): Promise<IbkrContractView[]> {
    return this.service.list();
  }

  @Post('refresh')
  refresh(): Promise<IbkrRefreshView> {
    return this.service.refresh();
  }

  @Post('market-data/refresh')
  refreshMarketData(): Promise<{ requestId: string; stored: number }> {
    return this.service.refreshHistory();
  }
}
