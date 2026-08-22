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
