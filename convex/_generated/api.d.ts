/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as answers from "../answers.js";
import type * as canonicalize from "../canonicalize.js";
import type * as careTeam from "../careTeam.js";
import type * as community from "../community.js";
import type * as fda from "../fda.js";
import type * as guidelines from "../guidelines.js";
import type * as impact from "../impact.js";
import type * as lib_anatomy from "../lib/anatomy.js";
import type * as lib_answerSchema from "../lib/answerSchema.js";
import type * as lib_careFor from "../lib/careFor.js";
import type * as lib_cat from "../lib/cat.js";
import type * as lib_drugTable from "../lib/drugTable.js";
import type * as lib_embed from "../lib/embed.js";
import type * as lib_evidence from "../lib/evidence.js";
import type * as lib_impact from "../lib/impact.js";
import type * as lib_labelNames from "../lib/labelNames.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_medReview from "../lib/medReview.js";
import type * as lib_moderation from "../lib/moderation.js";
import type * as lib_moderationFixtures from "../lib/moderationFixtures.js";
import type * as lib_pillMatch from "../lib/pillMatch.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_retrier from "../lib/retrier.js";
import type * as lib_safety from "../lib/safety.js";
import type * as lib_seedData from "../lib/seedData.js";
import type * as lib_swapCheck from "../lib/swapCheck.js";
import type * as lib_vision from "../lib/vision.js";
import type * as lib_warningSigns from "../lib/warningSigns.js";
import type * as logs from "../logs.js";
import type * as meds from "../meds.js";
import type * as moderation from "../moderation.js";
import type * as profiles from "../profiles.js";
import type * as questions from "../questions.js";
import type * as reviewer from "../reviewer.js";
import type * as seed from "../seed.js";
import type * as sheet from "../sheet.js";
import type * as swaps from "../swaps.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  answers: typeof answers;
  canonicalize: typeof canonicalize;
  careTeam: typeof careTeam;
  community: typeof community;
  fda: typeof fda;
  guidelines: typeof guidelines;
  impact: typeof impact;
  "lib/anatomy": typeof lib_anatomy;
  "lib/answerSchema": typeof lib_answerSchema;
  "lib/careFor": typeof lib_careFor;
  "lib/cat": typeof lib_cat;
  "lib/drugTable": typeof lib_drugTable;
  "lib/embed": typeof lib_embed;
  "lib/evidence": typeof lib_evidence;
  "lib/impact": typeof lib_impact;
  "lib/labelNames": typeof lib_labelNames;
  "lib/llm": typeof lib_llm;
  "lib/medReview": typeof lib_medReview;
  "lib/moderation": typeof lib_moderation;
  "lib/moderationFixtures": typeof lib_moderationFixtures;
  "lib/pillMatch": typeof lib_pillMatch;
  "lib/prompts": typeof lib_prompts;
  "lib/retrier": typeof lib_retrier;
  "lib/safety": typeof lib_safety;
  "lib/seedData": typeof lib_seedData;
  "lib/swapCheck": typeof lib_swapCheck;
  "lib/vision": typeof lib_vision;
  "lib/warningSigns": typeof lib_warningSigns;
  logs: typeof logs;
  meds: typeof meds;
  moderation: typeof moderation;
  profiles: typeof profiles;
  questions: typeof questions;
  reviewer: typeof reviewer;
  seed: typeof seed;
  sheet: typeof sheet;
  swaps: typeof swaps;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
};
