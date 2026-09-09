/** End of the open beta test period (local end of day). */
export const BETA_END_DATE = new Date('2026-09-12T23:59:59');

/** Shown on the landing page (DD.MM.YYYY). */
export const BETA_END_DATE_LABEL = '12.09.2026';

/** Matches the GDPR personal data notice (DD.MM.YY). */
export const BETA_DATA_REMOVAL_NOTICE =
  'All server-held test data will be removed on 12.09.26 (DD.MM.YY).';

export function isBetaPeriodActive(now = Date.now()): boolean {
  return now <= BETA_END_DATE.getTime();
}
