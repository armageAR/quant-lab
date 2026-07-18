import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ApplicationMetrics } from '@quant-lab/shared';
import type { DatabaseLifecycle } from '@quant-lab/database';
import {
  CcxtReadOnlyExchangeAdapter,
  type ConnectivityConfig,
  venueConfig,
} from '@quant-lab/exchange-adapters';
import { MarketCatalog } from '@quant-lab/market-catalog';
import {
  ExecutableOpportunityService,
  MarketEventStore,
  ObservedOpportunityService,
} from '@quant-lab/market-ingestion';
import type { Logger } from 'pino';
import {
  BacktestRunService,
  executeArbitrageBacktest,
} from '@quant-lab/simulation';
import { PaperTradingService } from '@quant-lab/paper-trading';

import { buildExecutableDetectorConfig, type WorkerConfig } from './config';
import { ObservationLoop, type ObservationStatus } from './observation-loop';
import {
  CONNECTIVITY_CONFIG,
  DATABASE,
  METRICS,
  WORKER_CONFIG,
  WORKER_LOGGER,
} from './tokens';

export interface WorkerObservationStatus extends ObservationStatus {
  enabled: boolean;
}

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  readonly #providers: CcxtReadOnlyExchangeAdapter[] = [];
  #loop?: ObservationLoop;
  #backtestTimer?: NodeJS.Timeout;
  #backtestExecution?: Promise<void>;
  #paperTimer?: NodeJS.Timeout;
  #paperExecution?: Promise<void>;
  #stopping = false;

  constructor(
    @Inject(WORKER_LOGGER) private readonly logger: Logger,
    @Inject(METRICS) private readonly metrics: ApplicationMetrics,
    @Inject(DATABASE) private readonly database: DatabaseLifecycle,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    @Inject(CONNECTIVITY_CONFIG)
    private readonly connectivity: ConnectivityConfig,
  ) {}

  onModuleInit(): void {
    this.metrics.workerReady.set(1);
    if (
      this.config.OBSERVATION_LOOP_ENABLED &&
      this.connectivity.EXCHANGE_CONNECTIVITY_ENABLED
    ) {
      const venues = [
        ...(this.connectivity.BINANCE_INTEGRATION_ENABLED
          ? (['binance'] as const)
          : []),
        ...(this.connectivity.KRAKEN_INTEGRATION_ENABLED
          ? (['kraken'] as const)
          : []),
      ];
      this.#providers.push(
        ...venues.map(
          (venue) =>
            new CcxtReadOnlyExchangeAdapter(
              venueConfig(this.connectivity, venue),
            ),
        ),
      );
      if (this.#providers.length > 0) {
        this.#loop = new ObservationLoop(
          this.database.client,
          this.#providers,
          new MarketCatalog(this.database.client),
          new MarketEventStore(this.database.client, this.metrics),
          new ObservedOpportunityService(this.database.client),
          {
            intervalMs: this.config.OBSERVATION_INTERVAL_MS,
            catalogRefreshMs: this.config.OBSERVATION_CATALOG_REFRESH_MS,
            orderBookDepth: this.config.OBSERVATION_ORDER_BOOK_DEPTH,
            maxBackoffMs: this.config.OBSERVATION_MAX_BACKOFF_MS,
            markets: this.connectivity.EXCHANGE_MARKETS,
            detector: {
              id: 'cross-venue-observed',
              version: this.config.OBSERVED_DETECTOR_VERSION,
              maximumBookAgeMs: this.config.OBSERVED_MAX_BOOK_AGE_MS,
              maximumCrossVenueSkewMs: this.config.OBSERVED_MAX_SKEW_MS,
              minimumObservedSpread: this.config.OBSERVED_MIN_SPREAD,
            },
          },
          this.logger,
          this.config.EXECUTABLE_DETECTOR_ENABLED
            ? {
                service: new ExecutableOpportunityService(
                  this.database.client,
                  this.config.OBSERVATION_ORDER_BOOK_DEPTH,
                ),
                detector: buildExecutableDetectorConfig(this.config),
              }
            : undefined,
        );
        this.#loop.start();
      }
    }
    this.logger.info(
      { observationEnabled: Boolean(this.#loop) },
      'Worker ready',
    );
    const backtests = new BacktestRunService(this.database.client);
    const poll = () => {
      if (this.#stopping || this.#backtestExecution) return;
      this.#backtestExecution = backtests
        .executeNext((run, events, control) =>
          executeArbitrageBacktest(run, events, {
            checkpoint: (processed, total) =>
              control.checkpoint(processed, total),
          }),
        )
        .then(() => undefined)
        .catch((error: unknown) =>
          this.logger.error({ err: error }, 'Backtest queue poll failed'),
        )
        .finally(() => {
          this.#backtestExecution = undefined;
        });
    };
    this.#backtestTimer = setInterval(
      poll,
      this.config.BACKTEST_POLL_INTERVAL_MS,
    );
    this.#backtestTimer.unref();
    poll();
    if (this.config.PAPER_TRADING_ENABLED) {
      const paper = new PaperTradingService(this.database.client);
      const pollPaper = () => {
        if (this.#stopping || this.#paperExecution) return;
        this.#paperExecution = this.runPaperCycle(paper)
          .catch((error: unknown) =>
            this.logger.error({ err: error }, 'Paper trading poll failed'),
          )
          .finally(() => {
            this.#paperExecution = undefined;
          });
      };
      this.#paperTimer = setInterval(
        pollPaper,
        this.config.PAPER_TRADING_POLL_INTERVAL_MS,
      );
      this.#paperTimer.unref();
      pollPaper();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.metrics.workerReady.set(0);
    this.#stopping = true;
    if (this.#backtestTimer) clearInterval(this.#backtestTimer);
    if (this.#paperTimer) clearInterval(this.#paperTimer);
    this.logger.info('Worker stopped accepting operations');
    await this.#backtestExecution;
    await this.#paperExecution;
    await this.#loop?.stop();
    await Promise.all(this.#providers.map((provider) => provider.close()));
  }

  private async runPaperCycle(paper: PaperTradingService): Promise<void> {
    const sessions = await this.database.client.paperSession.findMany({
      where: { status: 'running' },
      select: { id: true },
    });
    for (const session of sessions) {
      const executed = await this.database.client.paperOrder.findMany({
        where: { sessionId: session.id, opportunityId: { not: null } },
        select: { opportunityId: true },
      });
      const opportunity =
        await this.database.client.executableOpportunity.findFirst({
          where: {
            classification: 'executable',
            id: {
              notIn: executed.flatMap((item) =>
                item.opportunityId ? [item.opportunityId] : [],
              ),
            },
          },
          orderBy: { evaluatedAt: 'asc' },
          select: { id: true },
        });
      if (opportunity)
        await paper.executeOpportunity(session.id, opportunity.id);
    }
  }

  status(): WorkerObservationStatus {
    return {
      enabled: Boolean(this.#loop),
      ...(this.#loop?.status() ?? {
        state: 'stopped',
        cycles: 0,
        consecutiveFailures: 0,
        orderBooks: 0,
        orderBookFailures: 0,
        evaluations: 0,
        observed: 0,
        rejected: 0,
        executableEvaluations: 0,
        executable: 0,
        missed: 0,
      }),
    };
  }
}
