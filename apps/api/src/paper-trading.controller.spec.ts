import type { PaperTradingService } from '@quant-lab/paper-trading';
import { describe, expect, it, vi } from 'vitest';
import { PaperTradingController } from './paper-trading.controller';

describe('PaperTradingController', () => {
  it('requires explicit balances and limits', () => {
    const controller = new PaperTradingController({} as PaperTradingService);
    expect(() => controller.create({ name: 'paper' })).toThrow(
      'initialBalances and limits are required',
    );
  });
  it('forwards emergency stop explicitly', async () => {
    const paper = {
      control: vi.fn().mockResolvedValue({ status: 'emergency_stopped' }),
    };
    const controller = new PaperTradingController(
      paper as unknown as PaperTradingService,
    );
    await expect(
      controller.control('session', 'emergency-stop'),
    ).resolves.toEqual({ status: 'emergency_stopped' });
    expect(paper.control).toHaveBeenCalledWith('session', 'emergency-stop');
  });
});
