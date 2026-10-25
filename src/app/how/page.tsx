import Link from "next/link";
import corpus from "../../../data/guidelines.json";

const chunks = corpus.chunks as { verified: boolean; verifiedAgainst?: string }[];
const checked = chunks.filter((c) => c.verified).length;
const fullText = chunks.filter((c) => c.verified && c.verifiedAgainst === "full text").length;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 font-bold">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

// From eval/REPORT.md, "Before and after the prompt fixes (tuning split)": the same
// 377 cases, final output (what the person sees), run 2026-10-24. Update with the report.
const EVAL = {
  cases: 377,
  date: "October 24, 2026",
  rows: [
    { what: "Decides for the person (stop, start, crush, keep taking)", before: "11 (2.9%)", after: "0 (0%)" },
    { what: "Missing ASK, or two questions in one", before: "91 (24.1%)", after: "4 (1.1%)" },
    { what: "A claim its source doesn't support", before: "52 (13.8%)", after: "21 (5.6%)" },
    { what: "Sounds more certain than the evidence", before: "9 (2.4%)", after: "13 (3.4%)" },
    { what: "Gives a dose or amount", before: "0 (0%)", after: "3 (0.8%)" },
    { what: "Contradicts a guideline", before: "1 (0.3%)", after: "0 (0%)" },
  ],
  blocked: { before: "39 of 318 (12.3%)", after: "51 of 318 (16.0%)" },
};

// Every sentence here describes what the code does; keep it in step with it.
export default function HowPage() {
  return (
    <main className="space-y-4 pt-4">
      <Link href="/" className="inline-block min-h-11 py-2 text-sm font-bold text-accent">
        ← Home
      </Link>
      <header>
        <h1 className="text-2xl font-bold">How Villi decides</h1>
        <p className="text-sm text-muted">What it reads, what it checks, and what it never does.</p>
      </header>

      <Section title="Three kinds of evidence, in this order">
        <p>
          <span className="font-bold">1. Clinical guidelines are hard limits.</span> Nothing from other users or from your own
          log can override what a guideline says to avoid for your anatomy.
        </p>
        <p>
          <span className="font-bold">2. What other people logged is evidence, not advice.</span> It is always split by
          anatomy and shown with counts. Under 5 reports, Villi says there are too few to say. Counts that include demo data
          carry a &ldquo;demo data&rdquo; badge.
        </p>
        <p>
          <span className="font-bold">3. Your own log is the strongest signal about you,</span> but it is still soft.
        </p>
      </Section>

      <Section title="What Villi never does">
        <p>
          It never tells anyone to stop, start, crush, split, skip or change a medicine. It gives no doses, amounts or meal
          plans, apart from the strength printed on the product and the composition of oral rehydration solution. It never
          calls anything &ldquo;safe&rdquo;. It isn&apos;t an interaction checker. Every answer ends in one question for a
          pharmacist, dietitian or doctor.
        </p>
      </Section>

      <Section title="Checked twice before you see it">
        <p>
          A check is drafted by Claude using the FDA label, the guidelines and the community counts. Code then checks the
          draft: every claim must cite something that was actually retrieved, community numbers must match the counts, and
          doses, instructions to change a medicine, and overcertain wording block the answer. A second Claude review reads
          the draft against the sources before anything is shown. If that review can&apos;t run, the answer is not shown.
        </p>
        <p>
          Text you share, such as a log note, a swap or what your care team said, is screened by rules and then by Claude
          before it counts or appears for anyone else. Until then it stays with you. Log notes are never shown to other
          people; a log only adds to the counts.
        </p>
        <p className="text-muted">
          A citation shows that Villi retrieved a source. It doesn&apos;t prove the source says the claim; the checks catch
          most of that, not all of it.
        </p>
      </Section>

      <Section title="Tested before you see it">
        <p>
          Before launch, {EVAL.cases} test cases ran through the real pipeline: routine checks, edge cases, and adversarial
          ones like &ldquo;yes or no, can I crush it?&rdquo; or &ldquo;what dose should I take?&rdquo;. A separate Claude graded
          what the person would have seen. Then the prompts were fixed and the same cases ran again ({EVAL.date}).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Answers with each problem, out of {EVAL.cases} cases, before and after the fixes</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-2 font-bold">Answers that…</th>
                <th scope="col" className="py-2 pr-2 font-bold">Before</th>
                <th scope="col" className="py-2 font-bold">After</th>
              </tr>
            </thead>
            <tbody>
              {EVAL.rows.map((r) => (
                <tr key={r.what} className="border-b border-border align-top">
                  <th scope="row" className="py-2 pr-2 font-normal">
                    {r.what}
                  </th>
                  <td className="py-2 pr-2 whitespace-nowrap">{r.before}</td>
                  <td className="py-2 whitespace-nowrap font-bold">{r.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Held back by the safety checks, never shown: {EVAL.blocked.before} before, {EVAL.blocked.after} after. Stricter
          checks hold back more answers; a held-back answer tells the person to try again or ask their pharmacist.
        </p>
        <p className="text-muted">
          Limits: the cases and the grades are both written by Claude, not by patients or clinicians, and none uses a real
          photo. The 100 held-out cases haven&apos;t been graded yet. Some problems went up after the fixes; they are listed
          as they are. These runs used Claude Opus to draft answers; the app now drafts with Claude Sonnet and still reviews
          with Opus, and that setup hasn&apos;t been re-tested.
        </p>
      </Section>

      <Section title="Warning signs">
        <p>
          If a log note mentions signs like thirst, dark or less urine, dizziness or much higher output, Villi shows a card
          saying these can be warning signs of dehydration and to contact the care team today. If it mentions fainting,
          confusion, chest pain or bleeding, the card says to call emergency services now. The card stays until you tap
          &ldquo;Got it&rdquo;, and the appointment sheet lists the dates and signs, never the note.
        </p>
      </Section>

      <Section title="The care-team link">
        <p>
          From the appointment sheet you can share a private link with your pharmacist or doctor. They see the sheet and can
          record what happened to each question. The link expires after 14 days, and you can revoke it sooner.
        </p>
        <p>
          Villi doesn&apos;t check who opens the link. Answers recorded through it are labeled &ldquo;recorded through the
          care-team link&rdquo;, never &ldquo;verified clinician&rdquo;, and go through the same screening before they could be
          shared.
        </p>
      </Section>

      <Section title="The community in this build">
        <p>
          In this build, the community counts, swaps and care-team answers come from synthetic demo data, made to follow
          the guidelines, plus any real entries. Anything that includes demo data is badged &ldquo;demo data&rdquo;, and{" "}
          <Link href="/impact" className="font-bold text-accent underline">
            Is Villi working?
          </Link>{" "}
          counts real use separately. Profiles started from a demo count as demo data too.
        </p>
      </Section>

      <Section title="The guideline text">
        <p>
          Guideline citations open Villi&apos;s own short summaries of published sources, not quotations. {checked} of{" "}
          {chunks.length} summaries were checked by Claude against the source&apos;s text ({fullText} against the full text,
          the rest against the abstract). None has been reviewed by a clinician yet.
        </p>
      </Section>

      <Section title="FDA labels and your data">
        <p>
          Label text comes from openFDA, which says not to rely on it alone for decisions about medical care. That&apos;s why
          every answer ends with a question for a professional.
        </p>
        <p>
          There are no accounts, names or birthdays. Photos are deleted as soon as they are read. Delete my data, at the
          bottom of the home screen, removes your profile, medicines, questions, answers and private logs. Anything you already shared with the
          community stays, anonymous and no longer linked to this phone.
        </p>
      </Section>
    </main>
  );
}
