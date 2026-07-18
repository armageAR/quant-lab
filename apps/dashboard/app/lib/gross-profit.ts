const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/** Formats rate * USD 100 without converting financial values to floating point. */
export function grossProfitFor100(rate?: string): string | undefined {
  if (!rate) return undefined;
  const match = DECIMAL.exec(rate);
  if (!match) return undefined;

  const negative = match[1] === '-';
  const fraction = match[3] ?? '';
  const unscaled = BigInt(`${match[2]}${fraction}`) * 100n;
  const outputScale = 4;
  let rounded: bigint;

  if (fraction.length > outputScale) {
    const divisor = 10n ** BigInt(fraction.length - outputScale);
    rounded = (unscaled + divisor / 2n) / divisor;
  } else {
    rounded = unscaled * 10n ** BigInt(outputScale - fraction.length);
  }

  const scale = 10n ** BigInt(outputScale);
  const whole = rounded / scale;
  const decimals = String(rounded % scale).padStart(outputScale, '0');
  const sign = negative && rounded !== 0n ? '-' : '';
  return `${sign}$${whole}.${decimals}`;
}
