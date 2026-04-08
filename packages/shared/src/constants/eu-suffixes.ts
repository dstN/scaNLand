/**
 * EU suffix variants found on food approval marks.
 * All map to the same meaning: the establishment is EU-approved.
 */
export const EU_SUFFIXES = ['EG', 'EC', 'CE', 'WE', 'EF', 'EY'] as const;

export type EuSuffix = (typeof EU_SUFFIXES)[number];

/**
 * Map each EU suffix variant to its canonical form for normalization.
 * All variants normalize to 'EG' (German canonical).
 */
export const EU_SUFFIX_CANONICAL: Record<string, EuSuffix> = {
  EG: 'EG',
  EC: 'EG',
  CE: 'EG',
  WE: 'EG',
  EF: 'EG',
  EY: 'EG',
};

/**
 * Check if a string is a valid EU suffix variant.
 */
export function isEuSuffix(value: string): value is EuSuffix {
  return EU_SUFFIXES.includes(value.toUpperCase() as EuSuffix);
}
