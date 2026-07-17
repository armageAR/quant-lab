import type {
  FeeSnapshot,
  Market as DomainMarket,
  TradingRules,
  Venue as DomainVenue,
} from '@quant-lab/core';
import type { DatabaseClient } from '@quant-lab/database';
import { createHash } from 'node:crypto';

import { canonicalPair } from './normalization';

export interface MarketCatalogProvider {
  readonly venue: DomainVenue;
  listMarkets(): Promise<readonly DomainMarket[]>;
  getTradingRules(marketId: string): Promise<TradingRules>;
  getEffectiveFees(
    marketIds?: readonly string[],
  ): Promise<readonly FeeSnapshot[]>;
  getCapabilities(): Promise<unknown>;
}

export interface RefreshResult {
  venueId: string;
  activeMarkets: number;
  inactiveMarkets: number;
}

export interface ComparableMarket {
  marketId: string;
  venueId: string;
  venueSymbol: string;
  canonicalSymbol: string;
  rules: {
    priceIncrement: string;
    quantityIncrement: string;
    minimumQuantity?: string;
    maximumQuantity?: string;
    minimumNotional?: string;
    effectiveAt: string;
  };
  fee: {
    maker: string;
    taker: string;
    source: string;
    effectiveAt: string;
  };
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function timestampDate(epochMicroseconds: bigint): Date {
  return new Date(Number(epochMicroseconds / 1_000n));
}

export class MarketCatalog {
  constructor(private readonly database: DatabaseClient) {}

  async refresh(
    providers: readonly MarketCatalogProvider[],
    allowlist: readonly string[],
  ): Promise<readonly RefreshResult[]> {
    const allowed = new Set(
      allowlist.map((symbol) => canonicalPair(symbol).canonicalSymbol),
    );
    const results: RefreshResult[] = [];
    for (const provider of providers) {
      results.push(await this.refreshVenue(provider, allowed));
    }
    return results;
  }

  async listComparableActiveMarkets(): Promise<readonly ComparableMarket[]> {
    const markets = await this.database.market.findMany({
      where: { status: 'active', spot: true },
      include: {
        instrument: true,
        tradingRules: { orderBy: { effectiveAt: 'desc' }, take: 1 },
        feeSchedules: { orderBy: { effectiveAt: 'desc' }, take: 1 },
      },
      orderBy: [{ instrumentId: 'asc' }, { venueId: 'asc' }],
    });
    const venueCount = new Map<string, Set<string>>();
    for (const market of markets) {
      const venues = venueCount.get(market.instrumentId) ?? new Set<string>();
      venues.add(market.venueId);
      venueCount.set(market.instrumentId, venues);
    }
    return markets.flatMap((market) => {
      const rule = market.tradingRules[0];
      const fee = market.feeSchedules[0];
      if (
        (venueCount.get(market.instrumentId)?.size ?? 0) < 2 ||
        !rule ||
        !fee
      ) {
        return [];
      }
      return [
        {
          marketId: market.id,
          venueId: market.venueId,
          venueSymbol: market.venueSymbol,
          canonicalSymbol: market.instrument.canonicalSymbol,
          rules: {
            priceIncrement: rule.priceIncrement.toString(),
            quantityIncrement: rule.quantityIncrement.toString(),
            ...(rule.minimumQuantity === null
              ? {}
              : { minimumQuantity: rule.minimumQuantity.toString() }),
            ...(rule.maximumQuantity === null
              ? {}
              : { maximumQuantity: rule.maximumQuantity.toString() }),
            ...(rule.minimumNotional === null
              ? {}
              : { minimumNotional: rule.minimumNotional.toString() }),
            effectiveAt: rule.effectiveAt.toISOString(),
          },
          fee: {
            maker: fee.maker.toString(),
            taker: fee.taker.toString(),
            source: fee.source,
            effectiveAt: fee.effectiveAt.toISOString(),
          },
        },
      ];
    });
  }

  private async refreshVenue(
    provider: MarketCatalogProvider,
    allowed: ReadonlySet<string>,
  ): Promise<RefreshResult> {
    const observedAt = new Date();
    const discovered = (await provider.listMarkets()).filter((market) => {
      if (!market.spot) return false;
      try {
        return allowed.has(canonicalPair(market.venueSymbol).canonicalSymbol);
      } catch {
        return false;
      }
    });
    const activeIds = discovered.map((market) => market.id);
    const capabilities = await provider.getCapabilities();

    await this.database.venue.upsert({
      where: { id: provider.venue.id },
      create: { ...provider.venue },
      update: {
        code: provider.venue.code,
        name: provider.venue.name,
        kind: provider.venue.kind,
        status: provider.venue.status,
      },
    });
    await this.database.capabilitySnapshot.upsert({
      where: {
        venueId_fingerprint: {
          venueId: provider.venue.id,
          fingerprint: fingerprint(capabilities),
        },
      },
      create: {
        venueId: provider.venue.id,
        fingerprint: fingerprint(capabilities),
        capabilities: capabilities as object,
        observedAt,
      },
      update: {},
    });

    const canonicalAllowed = [...allowed];
    await this.database.market.updateMany({
      where: {
        venueId: provider.venue.id,
        instrument: { canonicalSymbol: { in: canonicalAllowed } },
        ...(activeIds.length === 0 ? {} : { id: { notIn: activeIds } }),
      },
      data: { status: 'inactive', lastSeenAt: observedAt },
    });

    const fees = await provider.getEffectiveFees(activeIds);
    const feeByMarket = new Map(
      fees.flatMap((fee) =>
        fee.marketId ? [[fee.marketId, fee] as const] : [],
      ),
    );
    for (const market of discovered) {
      const pair = canonicalPair(market.venueSymbol);
      const rules = await provider.getTradingRules(market.id);
      const fee = feeByMarket.get(market.id);
      if (!fee) throw new Error(`fee missing for market ${market.id}`);
      await this.database.$transaction(async (transaction) => {
        await transaction.instrument.upsert({
          where: { canonicalSymbol: pair.canonicalSymbol },
          create: {
            id: pair.instrumentId,
            kind: 'spot',
            baseCurrency: pair.baseCurrency,
            quoteCurrency: pair.quoteCurrency,
            canonicalSymbol: pair.canonicalSymbol,
          },
          update: {
            baseCurrency: pair.baseCurrency,
            quoteCurrency: pair.quoteCurrency,
          },
        });
        await transaction.market.upsert({
          where: { id: market.id },
          create: {
            ...market,
            instrumentId: pair.instrumentId,
            firstSeenAt: observedAt,
            lastSeenAt: observedAt,
          },
          update: {
            instrumentId: pair.instrumentId,
            venueSymbol: market.venueSymbol,
            status: market.status,
            spot: market.spot,
            lastSeenAt: observedAt,
          },
        });
        await transaction.marketAlias.updateMany({
          where: {
            marketId: market.id,
            alias: { not: market.venueSymbol },
            validTo: null,
          },
          data: { validTo: observedAt },
        });
        const alias = await transaction.marketAlias.findFirst({
          where: {
            venueId: provider.venue.id,
            alias: market.venueSymbol,
            marketId: market.id,
            validTo: null,
          },
        });
        if (!alias) {
          await transaction.marketAlias.create({
            data: {
              venueId: provider.venue.id,
              marketId: market.id,
              alias: market.venueSymbol,
              validFrom: observedAt,
            },
          });
        }
        const ruleValues = {
          priceIncrement: rules.priceIncrement,
          quantityIncrement: rules.quantityIncrement,
          minimumQuantity: rules.minimumQuantity?.toString() ?? null,
          maximumQuantity: rules.maximumQuantity?.toString() ?? null,
          minimumNotional: rules.minimumNotional?.toString() ?? null,
        };
        await transaction.tradingRuleVersion.upsert({
          where: {
            marketId_fingerprint: {
              marketId: market.id,
              fingerprint: fingerprint(ruleValues),
            },
          },
          create: {
            marketId: market.id,
            fingerprint: fingerprint(ruleValues),
            ...ruleValues,
            effectiveAt: timestampDate(rules.effectiveAt.epochMicroseconds),
          },
          update: {},
        });
        const feeValues = {
          maker: fee.maker.toString(),
          taker: fee.taker.toString(),
          source: fee.source,
        };
        await transaction.feeScheduleVersion.upsert({
          where: {
            marketId_fingerprint: {
              marketId: market.id,
              fingerprint: fingerprint(feeValues),
            },
          },
          create: {
            marketId: market.id,
            fingerprint: fingerprint(feeValues),
            ...feeValues,
            effectiveAt: timestampDate(fee.effectiveAt.epochMicroseconds),
          },
          update: {},
        });
      });
    }
    return {
      venueId: provider.venue.id,
      activeMarkets: discovered.filter((market) => market.status === 'active')
        .length,
      inactiveMarkets: discovered.filter((market) => market.status !== 'active')
        .length,
    };
  }
}
