# Villi system card

A one-page account of what Villi is for, what it must never do, how it was tested, and where it can still fail. Details live in `README.md`, `eval/REPORT.md` and the in-app **How Villi decides** page (`/how`).

## Intended use

- **Users:** adults living with short bowel syndrome or an ostomy, and the family member who manages their medicines.
- **Task:** check whether a medicine or drink is likely to work for *this* anatomy, with every claim cited, and leave with one question for a pharmacist, dietitian or doctor.
- **Decision-maker:** always the professional. Villi flags, cites and writes the question.

## Out of scope, by design

- Telling anyone to start, stop, crush, split, skip or change a medicine, or giving doses, amounts or meal plans. The only exceptions are the strength printed on the product and the composition of oral rehydration solution.
- Saying anything is "safe". The three states are Flag to discuss, Nothing found in the sources I checked, and Can't tell yet.
- Drug interactions. Villi isn't an interaction checker.
- Foods. They can be logged, not checked.
- Answers in languages other than English. The interface is built for them, but this build doesn't produce them.
- Emergencies. Warning-sign phrases in a log show a card that says to contact the care team, or emergency services. The card gives no other advice.

## How an answer is made

1. A Claude Sonnet agent calls tools that are Convex functions: the FDA label (openFDA plus a 794-record drug table built from labels), 46 guideline summaries (vector search with a keyword fallback), community counts split by anatomy, and the person's own log. The model never chooses whose profile it reads.
2. Deterministic code checks the draft: every citation must be something the agent actually retrieved, community numbers must match the counts, and doses, directives, overcertain wording and a missing or double question are blocked.
3. A Claude Opus reviewer reads the draft against its sources. It can tighten wording or block the answer, but it can't add citations. If the reviewer is unavailable, nothing is shown.
4. Anything shared with the community is screened by rules, then by Claude Haiku, before it counts. It fails closed to private.

## Evaluation

| Set | What | Result |
|---|---|---|
| Tuning, 377 cases (129 routine, 173 adversarial, 75 edge) | Real pipeline, live models, Claude grader on seven dimensions; prompts and corpus fixed from this split only. Opus drafted. | After fixes: 0 answers decided for the person (from 11); 1.1% missed or doubled the question (from 24.1%); 5.6% had a claim its source doesn't support (from 13.8%); 0.8% gave a dose or amount (from 0); 16.0% held back (from 12.3%). |
| Held-out, 100 cases | Same pipeline on today's setup (Sonnet drafts, Opus reviews), run and graded through `claude -p`. | See `eval/REPORT.md` and `/how`. |
| Unit and integration tests | 133 tests with Claude, openFDA and Voyage scripted. | All pass. |

**What the evals don't cover:** real patients, real photos, or any clinician grading. The cases and the grades are both written by Claude, so they can share blind spots.

## Known failure modes and mitigations

| Risk | Mitigation | What's left |
|---|---|---|
| False reassurance | No "safe" state; sources listed; missing label sections reported | A "Nothing found" answer can still be read as reassurance |
| A citation that doesn't support its claim | A registry of what was retrieved; the reviewer reads the sources | 5.6% of tuning answers still had one |
| Wrong product read from a photo | The NDC dosage form decides the release form; the label used is shown; "Not right? Type the name instead" | Photos aren't in the eval |
| Advice leaking through paraphrase | Code checks plus the reviewer | Some doses or amounts went up after the fixes (0.8%) |
| Small, self-selected community data | Split by anatomy with denominators; "too few to say" under 5; demo data badged | This weekend the community is synthetic |
| Guideline summaries that drift from the source | Each summary records its section; Claude checked them against abstracts or full texts | No clinician has reviewed them yet |
| Someone posing as the care team | The link is labeled "recorded through the care-team link", never "verified"; it expires in 14 days and can be revoked | Villi can't verify who opened it |

## Privacy

No accounts, names, birthdays or free-text history. A random device id is the only credential. Photos are deleted as soon as they're read. "Delete my data" removes everything personal; anything already shared stays anonymous and unlinked.

## Not medical advice

Villi is not medical advice. Label text comes from openFDA, which says not to rely on it alone for medical decisions. Every answer ends in a question for a professional for that reason.
