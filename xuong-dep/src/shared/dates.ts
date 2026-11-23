/** Vietnam / Cambodia are both UTC+7 with no DST. */
const OFFSET_MS = 7 * 3600_000;

/** Local calendar date (yyyy-mm-dd) in UTC+7. */
export const localDate = (d: Date): string => new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** UTC ISO instant at local midnight of a yyyy-mm-dd date. */
export const localDayStartIso = (date: string): string => new Date(`${date}T00:00:00+07:00`).toISOString();

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const isDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
