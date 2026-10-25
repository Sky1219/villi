export const TEXT_SIZES = ["standard", "large", "largest"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const TEXT_SIZE_KEY = "villi.textSize";

export function parseTextSize(v: string | null | undefined): TextSize {
  return (TEXT_SIZES as readonly string[]).includes(v ?? "") ? (v as TextSize) : "standard";
}

// Runs in <head> before the first paint, so a saved size never flashes back to standard.
// Kept as a string because it must run before React loads.
export const TEXT_SIZE_BOOT = `try{var s=localStorage.getItem(${JSON.stringify(TEXT_SIZE_KEY)});if(s==="large"||s==="largest")document.documentElement.dataset.text=s}catch(e){}`;
