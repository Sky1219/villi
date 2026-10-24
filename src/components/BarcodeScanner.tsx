"use client";

import { useEffect, useRef, useState } from "react";

// Live camera barcode reader. The library loads only when the scanner opens.
export function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let done = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.EAN_13,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.CODE_128,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        // The callback can fire before the controls promise settles, so stop through `stop`.
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current ?? undefined,
          (result) => {
            if (!result || done) return;
            done = true;
            stop?.();
            onCode(result.getText());
          },
        );
        stop = () => controls.stop();
        if (done) controls.stop();
      } catch {
        setError("The camera couldn't start. Allow camera access, or take a photo or type the name instead.");
      }
    })();
    return () => {
      done = true;
      stop?.();
    };
  }, [onCode]);

  return (
    <div className="mb-3 rounded-xl border border-border bg-background p-3">
      <p className="mb-2 text-sm font-bold">Point the camera at the barcode on the bottle or box.</p>
      <video ref={videoRef} className="aspect-[4/3] w-full rounded-lg bg-surface-2 object-cover" muted playsInline aria-label="Camera preview" />
      {error && (
        <p role="alert" className="mt-2 text-sm text-flag">
          {error}
        </p>
      )}
      <button type="button" onClick={onClose} className="mt-2 min-h-11 w-full rounded-xl border border-border font-bold">
        Cancel
      </button>
    </div>
  );
}
