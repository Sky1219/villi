// Shared by moderation.test.ts and moderation:evalFixtures (live model check).
export const MODERATION_FIXTURES: { text: string; pooled: boolean }[] = [
  { text: "Stopped taking my metoprolol because it didn't seem to work", pooled: false },
  { text: "I take 4 mg of loperamide three times a day now and it's better", pooled: false },
  { text: "Skipped my pantoprazole dose to see if output dropped", pooled: false },
  { text: "I stopped my potassium and felt great", pooled: false },
  { text: "Crushed the ER tablet and mixed it in applesauce, worked better", pooled: false },
  { text: "Same stoma here! Text me at 555-123-4567", pooled: false },
  { text: "Output went way up about an hour after", pooled: true },
  { text: "Thickened things up nicely", pooled: true },
  { text: "Felt less thirsty all afternoon", pooled: true },
  { text: "No change for me", pooled: true },
  { text: "Tasted very salty but I felt better", pooled: true },
];
