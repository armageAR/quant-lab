import type { Ticker } from '@quant-lab/market-data';

export interface TickerSource {
  readonly venue: { id: string };
  fetchTicker(marketId: string): Promise<Ticker>;
}
export interface StreamStats {
  received: number;
  duplicates: number;
  gaps: number;
  reconnects: number;
}

export class PollingTickerStream {
  readonly stats: StreamStats = {
    received: 0,
    duplicates: 0,
    gaps: 0,
    reconnects: 0,
  };
  #stopped = false;
  constructor(
    private readonly source: TickerSource,
    private readonly marketIds: readonly string[],
    private readonly persist: (ticker: Ticker) => Promise<boolean>,
    private readonly intervalMs = 1000,
    private readonly gapMs = 5000,
  ) {}
  stop(): void {
    this.#stopped = true;
  }
  async run(durationMs?: number): Promise<StreamStats> {
    this.#stopped = false;
    const started = Date.now();
    const last = new Map<string, number>();
    let backoff = this.intervalMs;
    while (
      !this.#stopped &&
      (durationMs === undefined || Date.now() - started < durationMs)
    ) {
      try {
        for (const marketId of this.marketIds) {
          const ticker = await this.source.fetchTicker(marketId);
          const now = Date.now();
          const previous = last.get(marketId);
          if (previous !== undefined && now - previous > this.gapMs)
            this.stats.gaps++;
          last.set(marketId, now);
          if (await this.persist(ticker)) this.stats.received++;
          else this.stats.duplicates++;
        }
        backoff = this.intervalMs;
        await this.sleep(this.intervalMs);
      } catch {
        this.stats.reconnects++;
        await this.sleep(backoff);
        backoff = Math.min(backoff * 2, 30_000);
      }
    }
    return { ...this.stats };
  }
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
