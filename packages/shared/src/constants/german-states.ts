/**
 * German federal state codes (Bundesland) used in BVL approval numbers.
 * Format: "DE {STATE} {NUMBER} EG" → e.g., "DE NW 50264 EG"
 *
 * In the BVL dataset, approval numbers use the state code directly:
 * "NW 50264", "BY 12345", "RP 01006"
 */
export const GERMAN_STATE_CODES = [
  'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
  'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
] as const;

export type GermanStateCode = (typeof GERMAN_STATE_CODES)[number];

export const GERMAN_STATE_NAMES: Record<GermanStateCode, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

export function isGermanStateCode(value: string): value is GermanStateCode {
  return GERMAN_STATE_CODES.includes(value.toUpperCase() as GermanStateCode);
}
