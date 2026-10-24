// Wording for caregiver profiles. Pure, importable from both Convex runtimes and the client.

export type CaresFor = "parent" | "partner" | "child" | "other";

export const CARES_FOR_CHOICES: readonly (readonly [CaresFor, string])[] = [
  ["parent", "My parent"],
  ["partner", "My partner"],
  ["child", "My child"],
  ["other", "Another family member"],
] as const;

const PERSON: Record<CaresFor, string> = {
  parent: "your parent",
  partner: "your partner",
  child: "your child",
  other: "your family member",
};

// Who the caregiver is to the patient, for a sheet a clinician reads.
const CAREGIVER: Record<CaresFor, string> = {
  parent: "their son or daughter",
  partner: "their partner",
  child: "their parent",
  other: "a family member",
};

// "your parent" for caregivers, "you" for patients.
export function personFor(role: string, caresFor: CaresFor | null | undefined): string {
  if (role !== "caregiver") return "you";
  return caresFor ? PERSON[caresFor] : "the person you care for";
}

// "Prepared by: the patient" or "Prepared by: a family caregiver (their son or daughter)".
export function preparedBy(role: string, caresFor: CaresFor | null | undefined): string {
  if (role !== "caregiver") return "the patient";
  return `a family caregiver (${caresFor ? CAREGIVER[caresFor] : "a family member"})`;
}

// What the holder of a care-team link can record for a question, mapped to the
// same outcome the patient's "What did they say?" flow uses.
export const LINK_CHOICES = {
  formulation_changed: "Reviewed: form changed",
  dose_monitored: "Monitoring started",
  no_change: "No change needed",
  pending: "Will discuss at a visit",
} as const;
