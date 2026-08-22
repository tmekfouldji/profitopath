import { Decimal } from 'decimal.js';

declare const minorUnitsBrand: unique symbol;
export type MinorUnits = bigint & { readonly [minorUnitsBrand]: true };

export function minorUnits(value: bigint | number | string): MinorUnits {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  return parsed as MinorUnits;
}

export function addMinorUnits(left: MinorUnits, right: MinorUnits): MinorUnits {
  return minorUnits(left + right);
}

export function decimal(value: Decimal.Value): Decimal {
  return new Decimal(value);
}

export function multiplyDecimal(
  left: Decimal.Value,
  right: Decimal.Value,
): Decimal {
  return decimal(left).mul(right);
}

export function formatUsdMinor(value: bigint | number): string {
  const units = typeof value === 'bigint' ? value : BigInt(value);
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = (absolute / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}$${whole}.${cents}`;
}
