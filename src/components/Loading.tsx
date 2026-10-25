// A quiet placeholder in the shape of the page, instead of a bare "Loading…".
// Screen readers hear "Loading"; the blocks pulse only when motion is allowed.
export function Loading({ inline = false }: { inline?: boolean }) {
  const block = "rounded-2xl bg-surface-2 motion-safe:animate-[villi-pulse_1.2s_ease-in-out_infinite]";
  return (
    <div role="status" aria-label="Loading" className={inline ? "space-y-2" : "space-y-4 pt-6"}>
      {!inline && <div className={`h-8 w-1/3 ${block}`} />}
      <div className={`h-20 ${block}`} />
      <div className={`h-32 ${block}`} />
      {!inline && <div className={`h-20 ${block}`} />}
    </div>
  );
}
