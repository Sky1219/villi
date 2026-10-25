# Villi: submission write-up

Paste-ready sections for the hackathon submission page. Every claim matches the code on `main` and the README; update both together.

## Inspiration

My dad lost his entire large intestine and most of his small intestine, and spent years in and out of hospitals. His heart medicine is extended-release. The AGA's guidance for short bowel syndrome says sustained- and delayed-release medicines should be avoided. Nobody told us.

We're not unusual. In a 2025 study of 50 ostomy patients, over 60% said they lacked information that medicine can pass through undissolved (Remane 2025). A 2021 systematic review found 29 of 37 drugs studied in short bowel syndrome were absorbed less, and 6 lost their effect (Hong 2021).

## What it does

Villi is a phone-first web app for adults with short bowel syndrome or an ostomy, and the family members who manage their medicines.

- **Check a medicine or drink** by barcode, photo or name. Villi answers for *this* anatomy: a cited verdict that is never "safe" (Flag to discuss, Nothing found in the sources I checked, or Can't tell yet), the gut diagram, what people with the same anatomy logged, and one question to bring to the pharmacist.
- **Review the whole medicine list** at once from the FDA labels and the guidelines, with no AI call: about 40,000 words of labels for my dad's five medicines, read in about a tenth of a second.
- **Take it to the pharmacist**: a one-page review request, plus a private link where the pharmacist can record what changed.
- **Learn from each other**: anonymous counts split by anatomy, and swaps that must pass a guideline check. No messages, comments or profiles.

## How we measure impact

Live in the app at **Is Villi working?**, real use only, split by anatomy, with demo profiles excluded:

1. **Was it news?** Every flag asks "Did you know this already?"
2. **Did it reach a professional?** The question was asked.
3. **Did care change?** A logged answer where the form changed or monitoring started, within 30 days.
4. **Did it help?** A two-week "helped / no change / worse" check after a change.

Our pilot targets, set before any pilot data: at least half of answered flags are news, 40% reach a pharmacist, and 15% of those change care. The pilot plan (size, recruitment, baseline, cost) is in the README.

## How we built it

- **Claude in the product.** A Sonnet agent whose tools are Convex functions: the FDA label (openFDA plus a 794-record drug table), 46 guideline summaries, community counts and the user's own log. Deterministic code then checks every citation, count, dose and directive. An Opus reviewer reads the draft against its sources, and nothing is shown unless both pass. Haiku reads photos and screens anything shared with the community.
- **Claude building the product.** Claude Code, spec first: research, a roadmap and quick tasks in `.planning/`, then critique, accessibility and red-team passes. About 22 hours, 82 commits, 133 tests. Claude built the drug table from FDA labels, and every fact carries a verbatim label quote that code verifies. Claude also source-checked every guideline summary against the papers' text.
- **Stack.** Next.js, Convex (database, functions, scheduler, vector search, file storage), the Anthropic SDK, Voyage embeddings and openFDA.

## Challenges

- **Making a medical-adjacent AI that never decides.** Our first eval (377 cases, many adversarial) caught the agent answering "No, please don't crush it" when asked "can I crush it?" That is protective, but it's still a decision. After the prompt and corpus fixes: 0 answers decided for the person (down from 11), and 1.1% missed or doubled the question for the pharmacist (down from 24.1%). Some problems went up, and `/how` lists them as they are.
- **Real FDA data is messy.** Modern labels lack the fields we expected, so the dosage form comes from the NDC directory, and a single label can be 200 KB.
- **Honest numbers.** Demo profiles, seeded community data and real use are counted separately everywhere.

## What's next

- A clinician review of the 46 guideline summaries; today, only Claude has checked them.
- A pilot with an intestinal-rehabilitation clinic, with its pharmacists on the care-team links.
- At about $0.16 per check, $5,000 in credits is roughly 31,000 checks: three a week for a year for about 200 families.

## Try it

[villi.tech](https://villi.tech) → **Demo: the builder's dad**. Villi is not medical advice.
