// "Metoprolol succinate (Dr. Reddy's Laboratories Inc, Jan 13, 2026)": the label line
// shown under a review row and in the trace. openFDA dates are YYYYMMDD; some
// manufacturer names arrive with a trailing comma or period.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function labelDate(effectiveTime: string | null | undefined): string | null {
  const m = effectiveTime?.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return effectiveTime ?? null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : effectiveTime!;
}

export function labelUsedText(name: string | null | undefined, manufacturer: string | null | undefined, effectiveTime: string | null | undefined): string {
  const maker = manufacturer?.trim().replace(/[,.;\s]+$/, "") || "unknown manufacturer";
  const date = labelDate(effectiveTime);
  return `${name ?? ""} (${maker}${date ? `, ${date}` : ""})`.trim();
}
