const CURRENCY_ALIASES: Readonly<Record<string, string>> = {
  XBT: 'BTC',
  XDG: 'DOGE',
};

export interface CanonicalPair {
  baseCurrency: string;
  quoteCurrency: string;
  canonicalSymbol: string;
  instrumentId: string;
}

export function canonicalCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,20}$/.test(normalized)) {
    throw new TypeError(`invalid currency code: ${currency}`);
  }
  return CURRENCY_ALIASES[normalized] ?? normalized;
}

export function canonicalPair(symbol: string): CanonicalPair {
  const pair = symbol.trim().toUpperCase().split(':', 1)[0];
  const parts = pair?.split('/');
  if (!parts || parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new TypeError(`invalid spot market symbol: ${symbol}`);
  }
  const baseCurrency = canonicalCurrency(parts[0]);
  const quoteCurrency = canonicalCurrency(parts[1]);
  const canonicalSymbol = `${baseCurrency}/${quoteCurrency}`;
  return {
    baseCurrency,
    quoteCurrency,
    canonicalSymbol,
    instrumentId: `${baseCurrency}-${quoteCurrency}`,
  };
}
