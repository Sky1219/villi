# Submission video: two minutes, story first

Winning hackathon videos open on a person and a problem, not a login screen. This one has three kinds of shot:

- **[You film]**: real-world shots only you can take. Hands and objects are enough; no face is needed, and never film a stoma or a body.
- **[Screen]**: phone screen recordings. Click-by-click detail is in `scripts/record-notes.md`.
- **[Card]**: a plain text card, Atkinson Hyperlegible bold on oat paper (`#fbf6ef`), the app's own look.

Every line below is true of the code on `main`. If a shot shows something you cut, cut its line.

| # | Time | Shot | Voiceover |
|---|---|---|---|
| 1 | 0:00 | **[You film]** Your dad's real pill bottles on a kitchen table, one turned so "ER" on the label is readable. | "My dad lost his entire large intestine and most of his small intestine. This is his heart medicine. It's extended-release." |
| 2 | 0:08 | **[Card]** "29 of 37 drugs studied were absorbed less after bowel resection. — Hong 2021" then "Over 60% of ostomy patients lacked information about it. — Remane 2025" | "An extended-release pill can pass through a gut that short before it works. The guidelines say so. Nobody told us." |
| 3 | 0:18 | **[Screen]** Welcome screen, then **Demo: the builder's dad** → home. | "Villi is for people living with short bowel syndrome or an ostomy, and the family who manage their medicines." |
| 4 | 0:25 | **[Screen]** Type **Metoprolol succinate ER 50 mg** → **Check**. Let the trace run on screen; speed up the middle 2x if it's long. | "Villi reads his anatomy, the FDA label, the guidelines, and what people with the same anatomy logged. Code checks every citation and number, then a second Claude reviews the draft. He sees nothing until both pass." |
| 5 | 0:45 | **[Screen]** The answer: **Flag to discuss**, tap one source chip, the gut diagram, the question card. | "Every claim has a source. It never says safe and never decides. It writes one question for his pharmacist." |
| 6 | 0:58 | **[Screen]** Home → the medicine review line → the sheet's **Medicine list review**. | "His five labels are about forty thousand words. Villi reviews the whole list against his anatomy in a tenth of a second." |
| 7 | 1:08 | **[Screen]** On a flag: **Did you or your parent know this already?** → **New to us**. | "And it asks one thing: was this news to you? That's how we'll know the problem is real." |
| 8 | 1:15 | **[You film]** The printed review request on a pharmacy counter, or on your table next to the bottles. A hand slides it forward. | "This is the page we bring to his pharmacist. They can open a private link and record what changed." |
| 9 | 1:25 | **[Screen]** Footer → **Is Villi working?** → scroll from "Was the flag news?" to the funnel. | "Was it news, did it reach a pharmacist, did something change, how did it go two weeks later. Real use only, by anatomy. This weekend, that's my dad." |
| 10 | 1:38 | **[Screen]** **How Villi decides** → **Tested before you see it** table. | "Before launch, we ran hundreds of test cases, many of them trying to make it say 'yes, crush it'. After our fixes, zero answers decided for the patient." |
| 11 | 1:50 | **[Card]** "Villi. Can a body with this much intestine actually use this? villi.tech" | "Villi. Built with Claude, for the people nobody told." |

## Recording notes

- Record the screen at phone size (the deployed app on your phone, or the laptop browser at 375 px). Do Not Disturb on, brightness up.
- Pre-run the metoprolol check once before recording, so if the live one is slow you can cut to the finished answer (see `DEMO.md`, "If something breaks").
- Use your dad's real profile for shots 6 to 9, so "Was the flag news?" and the funnel show real use. Shots 3 to 5 can use the demo.
- Keep music quiet and warm, or skip it. Captions on: many people in this community watch with the sound off.
