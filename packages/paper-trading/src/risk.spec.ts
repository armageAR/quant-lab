import { describe, expect, it } from 'vitest';
import { evaluateRisk } from './risk';

const limits = {
  maximumOrderNotional: '100',
  maximumVenueExposure: '1000',
  maximumDailyLoss: '50',
  maximumFeedAgeMs: 5000,
  maximumInventoryImbalance: '0.25',
};

describe('paper risk gate', () => {
  it('returns every explicit block reason', () => {
    expect(
      evaluateRisk(limits, {
        orderNotional: '101',
        venueExposure: '1001',
        dailyPnl: '-51',
        feedAgeMs: 5001,
        inventoryImbalance: '-0.26',
      }),
    ).toEqual([
      'maximum_order_notional',
      'maximum_venue_exposure',
      'maximum_daily_loss',
      'stale_feed',
      'inventory_imbalance',
    ]);
  });
  it('accepts values exactly at the configured boundaries', () => {
    expect(
      evaluateRisk(limits, {
        orderNotional: '100',
        venueExposure: '1000',
        dailyPnl: '-50',
        feedAgeMs: 5000,
        inventoryImbalance: '0.25',
      }),
    ).toEqual([]);
  });
});
