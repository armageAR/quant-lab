import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from './prisma.service';

interface HealthResponse {
  status: 'ok';
  time: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live(): HealthResponse {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw<Prisma.JsonObject[]>`SELECT 1`;
      return { status: 'ok', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
  }
}
