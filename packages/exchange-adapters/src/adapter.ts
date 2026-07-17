import {
  FeeRate,
  Money,
  Quantity,
  SourceTimestamp,
  eventTimepoint,
  type Balance,
  type FeeSnapshot,
  type Market,
  type TradingRules,
  type Venue,
  Price,
} from '@quant-lab/core';
import {
  ProviderError,
  type AccountReadCapabilities,
  type AccountStatus,
  type AuthenticatedAccountReadProvider,
  type ClockDriftSample,
  type CredentialPermissions,
  type ProviderSubscription,
} from '@quant-lab/market-data';
import type { Candle, Ticker, Trade } from '@quant-lab/market-data';

import type { CcxtMarket, CcxtTradingFee, ReadOnlyCcxtClient } from './client';
import type { VenueAdapterConfig } from './config';
import { createCcxtReadOnlyClient } from './factory';
import { ResilientExecutor } from './resilience';
import { NativeTickerWebSocket } from './ticker-websocket';

type RecordValue = Record<string, unknown>;

export interface ExchangeConnectivityReport {
  venueId: string;
  sandbox: boolean;
  permissionInspection: AccountStatus['permissionInspection'];
  permissions: CredentialPermissions;
  warnings: readonly string[];
  marketCount: number;
  configuredMarketsFound: readonly string[];
  balanceAssetCount: number;
  feeSnapshotCount: number;
  driftMicroseconds: string;
  roundTripMicroseconds: string;
}

export interface ExchangeAdapterDependencies {
  client?: ReadOnlyCcxtClient;
  wallClock?: () => SourceTimestamp;
  monotonicMilliseconds?: () => number;
  executor?: ResilientExecutor;
}

function asRecord(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null
    ? (value as RecordValue)
    : {};
}

function exactString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ProviderError(
      `${field} was not returned as an exact decimal string`,
      {
        code: 'invalid-response',
        venueId: 'unknown',
        operation: 'normalize',
        retryable: false,
      },
    );
  }
  return value;
}

function timestampFromMilliseconds(value: string | number): SourceTimestamp {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new RangeError(
      'exchange timestamp is outside the safe integer range',
    );
  }
  return SourceTimestamp.fromEpochMilliseconds(String(value), String(value));
}

function defaultWallClock(): SourceTimestamp {
  return SourceTimestamp.fromEpochMilliseconds(Date.now().toString());
}

function venueDefinition(venue: VenueAdapterConfig['venue']): Venue {
  return {
    id: venue.toUpperCase(),
    code: venue.toUpperCase(),
    name: venue === 'binance' ? 'Binance' : 'Kraken',
    kind: 'exchange',
    status: 'active',
  };
}

export class CcxtReadOnlyExchangeAdapter implements AuthenticatedAccountReadProvider {
  readonly venue: Venue;
  readonly #client: ReadOnlyCcxtClient;
  readonly #executor: ResilientExecutor;
  readonly #wallClock: () => SourceTimestamp;
  readonly #monotonicMilliseconds: () => number;
  #markets?: Record<string, CcxtMarket>;

  constructor(
    readonly config: VenueAdapterConfig,
    dependencies: ExchangeAdapterDependencies = {},
  ) {
    this.venue = venueDefinition(config.venue);
    this.#client = dependencies.client ?? createCcxtReadOnlyClient(config);
    this.#wallClock = dependencies.wallClock ?? defaultWallClock;
    this.#monotonicMilliseconds =
      dependencies.monotonicMilliseconds ?? performance.now.bind(performance);
    this.#executor =
      dependencies.executor ??
      new ResilientExecutor({
        venueId: this.venue.id,
        attempts: config.retryAttempts,
        timeoutMilliseconds: config.timeoutMilliseconds,
        circuitFailures: config.circuitFailures,
        circuitResetMilliseconds: config.circuitResetMilliseconds,
      });
  }

  getCapabilities(): Promise<AccountReadCapabilities> {
    return Promise.resolve({
      balances: this.#client.has.fetchBalance === true,
      effectiveFees: this.#client.has.fetchTradingFees === true,
      accountStatus: true,
      credentialPermissions: true,
    });
  }

  async getAccountStatus(): Promise<AccountStatus> {
    const payload = await this.#executor.run('inspectPermissions', () =>
      this.#client.inspectPermissions(),
    );
    const permissions = this.parsePermissions(payload);
    const warnings: string[] = [];
    if (permissions.trade) warnings.push('API key has trading permission');
    if (permissions.withdraw)
      warnings.push('API key has withdrawal permission');
    if (permissions.accountMutation)
      warnings.push('API key has another account-mutation permission');
    if (!permissions.read)
      warnings.push('API key does not expose required read permission');
    if (warnings.length > 0) {
      throw new ProviderError(warnings.join('; '), {
        code: 'authorization',
        venueId: this.venue.id,
        operation: 'inspectPermissions',
        retryable: false,
      });
    }
    return {
      enabled: true,
      permissions,
      permissionInspection: 'verified',
      warnings,
      observedAt: permissions.observedAt,
    };
  }

  async getBalances(): Promise<readonly Balance[]> {
    const payload = await this.#executor.run('fetchBalance', () =>
      this.#client.fetchBalance(),
    );
    const currencies = new Set([
      ...Object.keys(payload.free ?? {}),
      ...Object.keys(payload.used ?? {}),
      ...Object.keys(payload.total ?? {}),
    ]);
    const observedAt = this.#wallClock();
    return [...currencies].sort().map((currency) => {
      const normalized = currency.toUpperCase();
      return {
        currency: normalized,
        available: Money.from(
          exactString(payload.free?.[currency] ?? '0', 'balance.free'),
          normalized,
        ),
        locked: Money.from(
          exactString(payload.used?.[currency] ?? '0', 'balance.used'),
          normalized,
        ),
        total: Money.from(
          exactString(payload.total?.[currency] ?? '0', 'balance.total'),
          normalized,
        ),
        observedAt,
      };
    });
  }

  async listMarkets(): Promise<readonly Market[]> {
    const markets = await this.loadMarkets();
    return Object.values(markets)
      .filter((market) => market.spot === true)
      .map((market) => ({
        id: this.marketId(market),
        venueId: this.venue.id,
        instrumentId: `${market.base}-${market.quote}`.toUpperCase(),
        venueSymbol: market.symbol,
        status: market.active === false ? 'inactive' : 'active',
        spot: true,
      }));
  }

  async fetchTicker(marketId: string): Promise<Ticker> {
    const market = this.findMarket(await this.loadMarkets(), marketId);
    const value = await this.#executor.run('fetchTicker', () =>
      this.#client.fetchTicker(market.symbol),
    );
    const now = this.#wallClock();
    const event =
      value.timestamp === undefined
        ? undefined
        : timestampFromMilliseconds(value.timestamp);
    return {
      venueId: this.venue.id,
      marketId: this.marketId(market),
      source: 'rest',
      sourcePayload: value,
      time: eventTimepoint({
        ...(event ? { eventTime: event } : {}),
        receivedAt: now,
        processedAt: this.#wallClock(),
      }),
      ...(value.bid
        ? { bid: Price.from(value.bid, this.marketId(market)) }
        : {}),
      ...(value.bidVolume
        ? {
            bidQuantity: Quantity.from(
              value.bidVolume,
              `${market.base}-${market.quote}`,
            ),
          }
        : {}),
      ...(value.ask
        ? { ask: Price.from(value.ask, this.marketId(market)) }
        : {}),
      ...(value.askVolume
        ? {
            askQuantity: Quantity.from(
              value.askVolume,
              `${market.base}-${market.quote}`,
            ),
          }
        : {}),
      ...(value.last
        ? { last: Price.from(value.last, this.marketId(market)) }
        : {}),
    };
  }

  async fetchTrades(
    marketId: string,
    since?: number,
    limit = 100,
  ): Promise<readonly Trade[]> {
    const market = this.findMarket(await this.loadMarkets(), marketId);
    const received = this.#wallClock();
    const values = await this.#executor.run('fetchTrades', () =>
      this.#client.fetchTrades(market.symbol, since, Math.min(limit, 1000)),
    );
    return values
      .filter((v) => v.side === 'buy' || v.side === 'sell')
      .map((v) => {
        const event =
          v.timestamp === undefined
            ? undefined
            : timestampFromMilliseconds(v.timestamp);
        return {
          venueId: this.venue.id,
          marketId: this.marketId(market),
          tradeId: v.id,
          side: v.side as 'buy' | 'sell',
          price: Price.from(v.price, this.marketId(market)),
          quantity: Quantity.from(v.amount, `${market.base}-${market.quote}`),
          source: 'rest',
          sourcePayload: v,
          time: eventTimepoint({
            ...(event ? { eventTime: event } : {}),
            receivedAt: received,
            processedAt: this.#wallClock(),
          }),
        };
      });
  }

  async fetchCandles(
    marketId: string,
    interval: string,
    since?: number,
    limit = 100,
  ): Promise<readonly Candle[]> {
    const market = this.findMarket(await this.loadMarkets(), marketId);
    const received = this.#wallClock();
    const duration: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '1h': 3600000,
      '1d': 86400000,
    };
    const step = duration[interval];
    if (!step) throw new TypeError('unsupported candle interval');
    const values = await this.#executor.run('fetchOHLCV', () =>
      this.#client.fetchOHLCV(
        market.symbol,
        interval,
        since,
        Math.min(limit, 1000),
      ),
    );
    return values.map((v) => ({
      venueId: this.venue.id,
      marketId: this.marketId(market),
      interval,
      openedAt: timestampFromMilliseconds(v[0]),
      closedAt: timestampFromMilliseconds(v[0] + step),
      open: Price.from(v[1], this.marketId(market)),
      high: Price.from(v[2], this.marketId(market)),
      low: Price.from(v[3], this.marketId(market)),
      close: Price.from(v[4], this.marketId(market)),
      volume: Quantity.from(v[5], `${market.base}-${market.quote}`),
      source: 'rest',
      sourcePayload: v,
      time: eventTimepoint({
        eventTime: timestampFromMilliseconds(v[0]),
        receivedAt: received,
        processedAt: this.#wallClock(),
      }),
    }));
  }

  async subscribeTickers(
    marketIds: readonly string[],
    onTicker: (ticker: Ticker) => void | Promise<void>,
  ): Promise<ProviderSubscription> {
    const available = await this.listMarkets();
    const selected = marketIds.map((id) => {
      const market = available.find(
        (value) => value.id === id || value.venueSymbol === id,
      );
      if (!market)
        throw new ProviderError('spot market was not found', {
          code: 'not-found',
          venueId: this.venue.id,
          operation: 'subscribeTickers',
          retryable: false,
        });
      return market;
    });
    return new NativeTickerWebSocket({
      venue: this.venue,
      markets: selected,
      onTicker,
    });
  }

  async subscribeTickersWithTelemetry(
    marketIds: readonly string[],
    onTicker: (ticker: Ticker) => void | Promise<void>,
    telemetry: { onGap?: () => void; onRejected?: () => void },
  ): Promise<ProviderSubscription> {
    const available = await this.listMarkets();
    const selected = marketIds.map((id) => {
      const market = available.find(
        (value) => value.id === id || value.venueSymbol === id,
      );
      if (!market)
        throw new ProviderError('spot market was not found', {
          code: 'not-found',
          venueId: this.venue.id,
          operation: 'subscribeTickers',
          retryable: false,
        });
      return market;
    });
    return new NativeTickerWebSocket({
      venue: this.venue,
      markets: selected,
      onTicker,
      ...telemetry,
    });
  }

  async getTradingRules(marketId: string): Promise<TradingRules> {
    const market = this.findMarket(await this.loadMarkets(), marketId);
    const instrumentId = `${market.base}-${market.quote}`.toUpperCase();
    const priceIncrement = exactString(
      market.precision?.price,
      'market.precision.price',
    );
    const quantityIncrement = exactString(
      market.precision?.amount,
      'market.precision.amount',
    );
    return {
      marketId: this.marketId(market),
      priceIncrement,
      quantityIncrement,
      ...(market.limits?.amount?.min === undefined
        ? {}
        : {
            minimumQuantity: Quantity.from(
              exactString(market.limits.amount.min, 'amount.min'),
              instrumentId,
            ),
          }),
      ...(market.limits?.amount?.max === undefined
        ? {}
        : {
            maximumQuantity: Quantity.from(
              exactString(market.limits.amount.max, 'amount.max'),
              instrumentId,
            ),
          }),
      ...(market.limits?.cost?.min === undefined
        ? {}
        : {
            minimumNotional: Money.from(
              exactString(market.limits.cost.min, 'cost.min'),
              market.quote,
            ),
          }),
      effectiveAt: this.#wallClock(),
    };
  }

  async getEffectiveFees(
    marketIds?: readonly string[],
  ): Promise<readonly FeeSnapshot[]> {
    const markets = await this.loadMarkets();
    const fees =
      this.#client.has.fetchTradingFees === true
        ? await this.#executor.run('fetchTradingFees', () =>
            this.#client.fetchTradingFees(),
          )
        : {};
    const selected = marketIds?.length
      ? marketIds.map((marketId) => this.findMarket(markets, marketId))
      : Object.values(markets).filter((market) => market.spot === true);
    return selected.map((market) =>
      this.normalizeFee(market, fees[market.symbol]),
    );
  }

  async getClockDrift(): Promise<ClockDriftSample> {
    const startedWall = this.#wallClock();
    const startedMonotonic = this.#monotonicMilliseconds();
    const serverValue = await this.#executor.run('fetchTime', () =>
      this.#client.fetchTime(),
    );
    const finishedMonotonic = this.#monotonicMilliseconds();
    const finishedWall = this.#wallClock();
    const roundTripMicros = BigInt(
      Math.round((finishedMonotonic - startedMonotonic) * 1_000),
    );
    const midpoint =
      (startedWall.epochMicroseconds + finishedWall.epochMicroseconds) / 2n;
    const serverTime = timestampFromMilliseconds(serverValue);
    return {
      venueId: this.venue.id,
      sampledAt: finishedWall,
      serverTime,
      driftMicroseconds: (serverTime.epochMicroseconds - midpoint).toString(),
      roundTripMicroseconds: roundTripMicros.toString(),
    };
  }

  async verifyConnectivity(
    markets: readonly string[],
  ): Promise<ExchangeConnectivityReport> {
    const account = await this.getAccountStatus();
    const availableMarkets = await this.listMarkets();
    const found = markets.filter((symbol) =>
      availableMarkets.some((market) => market.venueSymbol === symbol),
    );
    for (const symbol of found) await this.getTradingRules(symbol);
    const balances = await this.getBalances();
    const fees = await this.getEffectiveFees(found);
    const drift = await this.getClockDrift();
    return {
      venueId: this.venue.id,
      sandbox: this.config.sandbox,
      permissionInspection: account.permissionInspection,
      permissions: account.permissions,
      warnings: account.warnings,
      marketCount: availableMarkets.length,
      configuredMarketsFound: found,
      balanceAssetCount: balances.length,
      feeSnapshotCount: fees.length,
      driftMicroseconds: drift.driftMicroseconds,
      roundTripMicroseconds: drift.roundTripMicroseconds,
    };
  }

  async close(): Promise<void> {
    await this.#client.close();
  }

  private async loadMarkets(): Promise<Record<string, CcxtMarket>> {
    this.#markets ??= await this.#executor.run('loadMarkets', () =>
      this.#client.loadMarkets(),
    );
    return this.#markets;
  }

  private findMarket(
    markets: Record<string, CcxtMarket>,
    idOrSymbol: string,
  ): CcxtMarket {
    const market = Object.values(markets).find(
      (candidate) =>
        candidate.symbol.toUpperCase() === idOrSymbol.toUpperCase() ||
        this.marketId(candidate) === idOrSymbol.toUpperCase(),
    );
    if (!market || market.spot !== true) {
      throw new ProviderError('spot market was not found', {
        code: 'not-found',
        venueId: this.venue.id,
        operation: 'findMarket',
        retryable: false,
      });
    }
    return market;
  }

  private marketId(market: CcxtMarket): string {
    return `${this.venue.id}:${market.id}`.toUpperCase();
  }

  private normalizeFee(
    market: CcxtMarket,
    accountFee?: CcxtTradingFee,
  ): FeeSnapshot {
    const maker = accountFee?.maker ?? market.maker;
    const taker = accountFee?.taker ?? market.taker;
    return {
      venueId: this.venue.id,
      marketId: this.marketId(market),
      maker: FeeRate.from(exactString(maker, 'fee.maker')),
      taker: FeeRate.from(exactString(taker, 'fee.taker')),
      effectiveAt: this.#wallClock(),
      source: accountFee
        ? 'authenticated-account-fee'
        : 'market-metadata-fallback',
    };
  }

  private parsePermissions(payload: unknown): CredentialPermissions {
    const observedAt = this.#wallClock();
    const record = asRecord(payload);
    if (this.config.venue === 'binance') {
      return {
        read: record.enableReading === true,
        trade:
          record.enableSpotAndMarginTrading === true ||
          record.enableMargin === true ||
          record.enableFutures === true,
        withdraw: record.enableWithdrawals === true,
        accountMutation:
          record.enableInternalTransfer === true ||
          record.permitsUniversalTransfer === true,
        observedAt,
      };
    }
    const result = asRecord(record.result ?? record);
    const values = Array.isArray(result.permissions)
      ? result.permissions.filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    return {
      read: values.includes('query-funds'),
      trade:
        values.includes('modify-trades') || values.includes('close-trades'),
      withdraw:
        values.includes('withdraw-funds') ||
        values.includes('add-withdraw-address') ||
        values.includes('update-withdraw-address'),
      accountMutation:
        values.includes('add-funds') || values.includes('earn-funds'),
      observedAt,
    };
  }
}
