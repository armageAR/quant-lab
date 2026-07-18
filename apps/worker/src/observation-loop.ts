import type { DatabaseClient } from '@quant-lab/database';
import type {
  MarketCatalog,
  MarketCatalogProvider,
} from '@quant-lab/market-catalog';
import type {
  ExecutableOpportunityService,
  MarketEventStore,
  ObservedOpportunityService,
} from '@quant-lab/market-ingestion';
import type {
  ExecutableDetectorConfig,
  ObservedDetectorConfig,
} from '@quant-lab/strategy-engine';
import type { OrderBook } from '@quant-lab/market-data';
import type { Logger } from 'pino';

interface ObservationProvider extends MarketCatalogProvider {
  fetchOrderBook(marketId: string, depth: number): Promise<OrderBook>;
}

export interface ObservationLoopConfig {
  intervalMs: number;
  catalogRefreshMs: number;
  orderBookDepth: number;
  maxBackoffMs: number;
  markets: readonly string[];
  detector: ObservedDetectorConfig;
}

export interface ExecutableStage {
  service: ExecutableOpportunityService;
  detector: ExecutableDetectorConfig;
}

export interface ObservationStatus {
  state: 'idle' | 'running' | 'backoff' | 'stopped';
  cycles: number;
  consecutiveFailures: number;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  nextRunAt?: string;
  orderBooks: number;
  evaluations: number;
  observed: number;
  rejected: number;
  executableEvaluations: number;
  executable: number;
  missed: number;
}

type Timer = ReturnType<typeof setTimeout>;

export class ObservationLoop {
  #timer?: Timer;
  #active?: Promise<void>;
  #stopping = false;
  #lastCatalogRefresh = 0;
  readonly #status: ObservationStatus = {
    state: 'idle',
    cycles: 0,
    consecutiveFailures: 0,
    orderBooks: 0,
    evaluations: 0,
    observed: 0,
    rejected: 0,
    executableEvaluations: 0,
    executable: 0,
    missed: 0,
  };

  constructor(
    private readonly database: DatabaseClient,
    private readonly providers: readonly ObservationProvider[],
    private readonly catalog: MarketCatalog,
    private readonly store: MarketEventStore,
    private readonly opportunities: ObservedOpportunityService,
    private readonly config: ObservationLoopConfig,
    private readonly logger: Logger,
    private readonly executable?: ExecutableStage,
  ) {}

  start(): void {
    if (this.#timer || this.#active || this.#stopping) return;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.#stopping = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#active;
    this.#status.state = 'stopped';
    delete this.#status.nextRunAt;
  }

  status(): ObservationStatus {
    return { ...this.#status };
  }

  async runOnce(now = new Date()): Promise<void> {
    this.#status.state = 'running';
    delete this.#status.nextRunAt;
    this.#status.lastStartedAt = now.toISOString();
    if (
      now.getTime() - this.#lastCatalogRefresh >=
      this.config.catalogRefreshMs
    ) {
      await this.catalog.refresh(this.providers, this.config.markets);
      this.#lastCatalogRefresh = now.getTime();
    }
    const markets = await this.database.market.findMany({
      where: {
        venueId: { in: this.providers.map((provider) => provider.venue.id) },
        status: 'active',
        spot: true,
        instrument: { canonicalSymbol: { in: [...this.config.markets] } },
      },
    });
    const books = await Promise.all(
      markets.map(async (market) => {
        const provider = this.providers.find(
          (candidate) => candidate.venue.id === market.venueId,
        );
        if (!provider) return false;
        return this.store.storeOrderBook(
          await provider.fetchOrderBook(market.id, this.config.orderBookDepth),
        );
      }),
    );
    const results = await this.opportunities.evaluateAll(
      this.config.detector,
      new Date(),
    );
    this.#status.cycles += 1;
    this.#status.consecutiveFailures = 0;
    this.#status.orderBooks = books.filter(Boolean).length;
    this.#status.evaluations = results.length;
    this.#status.observed = results.filter(
      (result) => result.classification === 'observed',
    ).length;
    this.#status.rejected = results.length - this.#status.observed;
    if (this.executable) {
      const executableResults = await this.executable.service.evaluateAll(
        this.executable.detector,
        new Date(),
      );
      this.#status.executableEvaluations = executableResults.length;
      this.#status.executable = executableResults.filter(
        (result) => result.classification === 'executable',
      ).length;
      this.#status.missed = executableResults.filter(
        (result) => result.classification === 'missed',
      ).length;
    }
    this.#status.lastCompletedAt = new Date().toISOString();
    this.#status.lastSuccessAt = this.#status.lastCompletedAt;
    delete this.#status.lastError;
  }

  private schedule(delay: number): void {
    if (this.#stopping) return;
    this.#status.nextRunAt = new Date(Date.now() + delay).toISOString();
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#active = this.tick().finally(() => {
        this.#active = undefined;
      });
    }, delay);
  }

  private async tick(): Promise<void> {
    let delay = this.config.intervalMs;
    try {
      await this.runOnce();
      this.#status.state = 'idle';
      this.logger.info(this.status(), 'Observation cycle completed');
    } catch (error) {
      this.#status.consecutiveFailures += 1;
      this.#status.lastError =
        error instanceof Error ? error.message : 'unknown observation error';
      delay = Math.min(
        this.config.intervalMs * 2 ** (this.#status.consecutiveFailures - 1),
        this.config.maxBackoffMs,
      );
      this.#status.state = 'backoff';
      this.logger.error({ err: error, delay }, 'Observation cycle failed');
    }
    this.schedule(delay);
  }
}
