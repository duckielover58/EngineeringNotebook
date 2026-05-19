/** Display notebook timestamps in Pacific (matches engilog migrations / school TZ). */
export const ENGILOG_DISPLAY_TZ = "America/Los_Angeles";

export function formatStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { timeZone: ENGILOG_DISPLAY_TZ });
}
