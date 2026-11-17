import { describe, expect, it } from "vitest";
import { describeReason } from "./reasons";

describe("describeReason", () => {
  it("names each reason in plain words", () => {
    expect(describeReason({ kind: "OFF" })).toBe("Flag is off");
    expect(describeReason({ kind: "RULE_MATCH", ruleId: "r2", ruleNumber: 2 })).toBe("Rule 2 matched");
    expect(describeReason({ kind: "DEFAULT_RULE" })).toBe("Default rule");
    expect(describeReason({ kind: "NO_MATCH" })).toBe("No rule matched");
  });
});
