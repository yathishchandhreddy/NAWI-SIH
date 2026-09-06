/**
 * OIML R 76-1:2006 Unit Conversion & Normalization Service
 * 
 * Ensures consistent, high-precision conversion between standard mass units
 * (kg, g, mg) per OIML R 76-1 Clause 2.1 (Units of measurement).
 */

export type MassUnit = 'kg' | 'g' | 'mg';

// Standard conversion factors to Grams (g) as common internal reference base
const TO_GRAMS_FACTORS: Record<MassUnit, number> = {
  kg: 1000,
  g: 1,
  mg: 0.001,
};

/**
 * Converts a numeric mass value from one mass unit to another.
 * e.g., convertMass(5, 'kg', 'g') -> 5000
 */
export function convertMass(
  value: number,
  fromUnit: MassUnit,
  toUnit: MassUnit
): number {
  if (fromUnit === toUnit || value === 0) return value;
  const inGrams = value * TO_GRAMS_FACTORS[fromUnit];
  const result = inGrams / TO_GRAMS_FACTORS[toUnit];
  return roundToPrecision(result, 8);
}

/**
 * Normalizes 'e' (verification scale interval) into the specified target unit.
 * e.g. e = 5 g, targetUnit = 'kg' -> 0.005 kg
 */
export function normalizeIntervalToUnit(
  intervalValue: number,
  intervalUnit: MassUnit,
  targetUnit: MassUnit
): number {
  return convertMass(intervalValue, intervalUnit, targetUnit);
}

/**
 * Formats a numeric value with controlled precision, eliminating floating point noise.
 */
export function roundToPrecision(value: number, decimals = 6): number {
  if (Math.abs(value) < 1e-12) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Formats mass for UI presentation with unit string.
 * e.g., formatMass(0.002, 'kg', 4) -> "+0.0020 kg" or "0.002 kg"
 */
export function formatMass(
  value: number,
  unit: string,
  precision = 4,
  withSign = false
): string {
  const rounded = roundToPrecision(value, precision);
  const sign = withSign && rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(precision)} ${unit}`;
}

/**
 * Formats plain number string without unnecessary trailing zeroes if integer.
 */
export function formatCleanNumber(value: number, precision = 4): string {
  const rounded = roundToPrecision(value, precision);
  // Keep formatted decimals without 10.000000 noise
  const str = rounded.toFixed(precision);
  return str.replace(/\.?0+$/, '') || '0';
}
