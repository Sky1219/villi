// Pure name helpers shared by fetch_label, the drug table lookup and scripts/build-drugs.ts.

export type ReleaseForm = "extended-release" | "delayed-release" | "liquid" | "immediate-release" | "unknown";

export function releaseFormOf(dosageForm: string): ReleaseForm {
  const f = dosageForm.toUpperCase();
  if (/EXTENDED RELEASE|EXTENDED-RELEASE|SUSTAINED|CONTROLLED/.test(f)) return "extended-release";
  if (/DELAYED RELEASE|DELAYED-RELEASE|ENTERIC/.test(f)) return "delayed-release";
  if (/^(TABLET|CAPSULE)/.test(f)) return "immediate-release";
  if (/SOLUTION|SUSPENSION|SYRUP|ELIXIR|LIQUID|DROPS/.test(f)) return "liquid";
  if (/POWDER|GRANULE/.test(f)) return "immediate-release";
  return "unknown";
}

export function hintFromName(name: string): ReleaseForm | null {
  const n = ` ${name.toLowerCase()} `;
  if (/\b(er|xl|xr|sr|cr|la|extended|sustained|controlled|24 ?hr?)\b/.test(n)) return "extended-release";
  if (/\b(dr|ec|delayed|enteric)\b/.test(n)) return "delayed-release";
  if (/\b(solution|liquid|syrup|suspension|elixir|oral solution)\b/.test(n)) return "liquid";
  return null;
}

// "Metoprolol succinate ER 50 mg tablets" -> "metoprolol succinate"
export function labelKeyFor(name: string): string {
  return `${coreName(name)}|${hintFromName(name) ?? "any"}`;
}

export function coreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|%|units?)(\s*\/\s*\d*\s*(ml|l))?/g, " ")
    .replace(
      /\b(er|xl|xr|sr|cr|la|dr|ec|extended|sustained|controlled|delayed|enteric|release|coated|tablets?|caps?|capsules?|oral|solution|liquid|syrup|suspension|elixir|hr|24)\b/g,
      " ",
    )
    .replace(/[^a-z0-9\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
