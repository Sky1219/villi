# Judge Q&A: hard questions, honest answers

Short answers to say out loud, with where to point if they want proof. Don't claim anything beyond these.

**"Isn't this medical advice? What about liability?"**
It's built so it never decides. There's no "safe" state, it never says to start, stop or crush anything, and it gives no doses. Every answer ends with one question for a pharmacist or doctor. Code blocks directives and doses before a second Claude reviews the answer, and nothing is shown unless both pass. It says "Villi is not medical advice" on every answer. → `/how`, "What Villi never does".

**"Is this regulated as medical software?"**
We haven't had a regulatory review, and we don't claim an exemption. It's designed as cited information plus a question for a professional, not a diagnosis or a treatment recommendation. A production version would need a proper regulatory review before launch. That's in our path to production.

**"How do you know the AI isn't making up citations?"**
Code keeps a registry of every source the agent actually retrieved, and deletes any citation that isn't in it. The reviewer then reads the claim against the source text. That catches most problems, not all: in our 377-case test, 5.6% of answers still had a claim its source doesn't fully support, and we show that number on `/how`. That's exactly why it ends in a question, not an instruction.

**"Why not just ask the pharmacist?"**
That's the goal. Villi gets you to the pharmacist with the right question. Today nobody tells patients to ask: in Remane 2025, over 60% of ostomy patients lacked this information. A pharmacist sees the review request with the label quote and the guideline already attached, and can record what changed through a private link.

**"Who validated the medical content?"**
Claude source-checked every guideline summary against the paper's abstract or full text, and the drug table keeps a verbatim label quote for every fact. No clinician has reviewed them yet, and the app says so. A clinician review is the first step after the hackathon.

**"The community data is fake?"**
This weekend, yes. It's synthetic, and every count that includes it carries a "demo data" badge. Real use is counted separately on "Is Villi working?", and demo profiles, including any judge's, never count as real. → `/impact`.

**"How will you get users?"**
Through the places this community already gathers: an intestinal-rehabilitation clinic's pharmacists, and patient groups like the Oley Foundation and the United Ostomy Associations of America. None is a partner today. The first real user is my dad.

**"How do you know it works?"**
Four numbers, live, real use only, by anatomy: was the flag news to the person, did the question reach a pharmacist, did care change, and how it went two weeks later. Our pilot targets are set before any data: half of flags are news, 40% reach a pharmacist, 15% of those change care. → `/impact`, README "Measuring impact".

**"What does it cost to run?"**
About $0.16 per check in our eval run, with Opus drafting; the app now drafts with Sonnet, which costs less. A check takes about 33 seconds at the median. The whole medicine list review needs no model call: about a tenth of a second. → README "How a check runs".

**"Why Claude, and why two models?"**
Sonnet runs the tool loop, where speed and cost matter. Opus does the one review call per answer, where reading the sources carefully matters most. Haiku reads photos and screens community posts. Claude also built the drug table and the eval, and found its own mistakes, like answering "can I crush it?" with "No, please don't": protective, but still a decision. After the fixes: zero.

**"What happens when Claude or openFDA is down?"**
Nothing unreviewed is ever shown: the answer says the service is busy and offers to try again. Label facts for the top 300 drugs come from Villi's own drug table, so a check still works if openFDA is down. Guideline search falls back to keywords if Voyage is down, and the trace says so.

**"What about older, tired or low-vision users?"**
The whole app uses Atkinson Hyperlegible, a typeface made for low vision, with 44px or larger tap targets. Three text sizes on home scale every screen. Any answer can be read aloud with the phone's own voice, so no audio leaves the phone and there's no extra AI call. At the pharmacy, **Show this to the pharmacist** puts the question full-screen in large type. → home header, any answer.

**"What about privacy? It's health data."**
No accounts, names or birthdays: a random id on the device is the only credential. Photos are deleted right after they're read, because bottle labels show names. "Delete my data" removes everything personal. Shared entries are anonymous and split only by coarse anatomy.

**"What would you do with the prize?"**
$5,000 in credits is roughly 31,000 checks: three a week for a year for about 200 families. Office hours would go to the hardest part, getting the reviewer's unsupported-claim rate down further.
