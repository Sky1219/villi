import { ActionRetrier } from "@convex-dev/action-retrier";
import { components } from "../_generated/api";

// Convex actions are at-most-once and never auto-retried; safety passes go
// through this, and each onComplete fails closed.
export const retrier = new ActionRetrier(components.actionRetrier, {
  initialBackoffMs: 1000,
  base: 2,
  maxFailures: 3,
});
