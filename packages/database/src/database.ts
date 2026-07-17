import { PrismaClient } from '@prisma/client';

export type DatabaseClient = PrismaClient;

export class DatabaseLifecycle {
  readonly client: DatabaseClient;

  constructor(client: DatabaseClient = new PrismaClient()) {
    this.client = client;
  }

  async connect(): Promise<void> {
    await this.client.$connect();
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

  async probe(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }
}
