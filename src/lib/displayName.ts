// Canonical item names are stored lowercase ("metoprolol succinate er"). For display:
// a capital first letter and release abbreviations in capitals ("Metoprolol succinate ER").
const ABBREVIATIONS = /\b(er|xl|xr|sr|cr|dr|ec|la|odt|cd|ors|ndc)\b/gi;

export function displayName(name: string): string {
  const cased = name.replace(ABBREVIATIONS, (m) => m.toUpperCase());
  return cased.charAt(0).toUpperCase() + cased.slice(1);
}
