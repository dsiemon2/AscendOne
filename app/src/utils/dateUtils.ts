/**
 * Returns today's date as a YYYY-MM-DD string in the user's LOCAL timezone.
 *
 * Why not `new Date().toISOString().split('T')[0]`?
 * → toISOString() always returns UTC. At 7 PM CST (UTC-6) the UTC date is
 *   already the NEXT calendar day, causing the app to show the wrong date and
 *   to query points_log / gratitudes with tomorrow's date (returning 0 rows).
 */
export function getLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Converts any Date object to a YYYY-MM-DD string using local time.
 * Safe to use for date-navigation arithmetic (add/subtract days, etc.).
 */
export function dateToLocalString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
