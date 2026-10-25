import { describe, expect, it } from "vitest";
import { connectionProblem } from "./ConnectionBanner";

describe("connectionProblem", () => {
  it("tells a dropped connection from one that never opened", () => {
    expect(connectionProblem({ isWebSocketConnected: true, hasEverConnected: true })).toBeNull();
    expect(connectionProblem({ isWebSocketConnected: false, hasEverConnected: true })).toBe("lost");
    expect(connectionProblem({ isWebSocketConnected: false, hasEverConnected: false })).toBe("never");
  });
});
