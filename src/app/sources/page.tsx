import Link from "next/link";
import corpus from "../../../data/guidelines.json";
import drugs from "../../../data/drugs.json";

// Static: every guideline chunk Villi can cite, grouped by source. Built at deploy time,
// so neither file ships to the browser.
export const dynamic = "force-static";

type Chunk = {
  sourceId: string;
  locator: string;
  text: string;
  anatomyScope: string[];
  section?: string;
  verified?: boolean;
  verifiedAgainst?: string;
};

const SOURCES = corpus.sources as Record<string, { title: string; url?: string }>;
const CHUNKS = corpus.chunks as Chunk[];

export default function SourcesPage() {
  const bySource = Object.keys(SOURCES).map((id) => ({ id, ...SOURCES[id], chunks: CHUNKS.filter((c) => c.sourceId === id) }));
  const checked = CHUNKS.filter((c) => c.verifiedAgainst).length;
  return (
    <main className="space-y-5 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Sources</h1>
        <p className="text-muted">
          Every guideline line Villi can cite, written in Villi&apos;s own words with the place in the source it comes from.
          {` ${checked} of ${CHUNKS.length}`} were checked by Claude against the source text; none has been reviewed by a clinician yet.
        </p>
        <p className="text-sm text-muted">
          Medicine facts come from the FDA label (openFDA) and Villi&apos;s drug table: {drugs.recordCount} products covering the{" "}
          {drugs.source.drugs} most-prescribed US drugs ({drugs.source.list}), with facts extracted from their openFDA labels by Claude
          ({drugs.model}) and each quoted back to the label, generated{" "}
          {new Date(drugs.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}. openFDA says not to
          rely on it alone for medical decisions.
        </p>
      </header>

      {bySource.map((s) => (
        <section key={s.id} className="space-y-2">
          <h2 className="font-bold">{s.title}</h2>
          {s.url && (
            <a href={s.url} className="inline-flex min-h-11 items-center text-sm font-bold text-accent underline" rel="noreferrer" target="_blank">
              Open the source
            </a>
          )}
          <ul className="space-y-2">
            {s.chunks.map((c) => {
              const id = `${c.sourceId}#${c.locator}`;
              return (
                <li key={id} id={id} className="scroll-mt-4 rounded-xl border border-border bg-surface p-3 target:border-accent target:bg-accent-soft">
                  <p>{c.text}</p>
                  <p className="mt-1 text-xs text-muted">
                    [G:{id}]{c.section ? ` · ${c.section}` : ""} · applies to {c.anatomyScope.join(", ")} ·{" "}
                    {c.verifiedAgainst ? `checked against the ${c.verifiedAgainst}` : "not yet checked against the source text"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
