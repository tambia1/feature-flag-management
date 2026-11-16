import { describe, expect, it } from "vitest";
import type { FlagConfig } from "@/app/types";
import { evaluateFlag, hashToPercent } from "./evaluate";

const base: FlagConfig = {
  key: "new-checkout",
  archived: false,
  isOn: true,
  offVariationId: "off",
  variations: [
    { id: "on", value: true, order: 0 },
    { id: "off", value: false, order: 1 },
  ],
  rules: [{ id: "default", clauses: [], serve: { variationId: "on" } }],
};

describe("evaluateFlag", () => {
  it("serves the off value when the flag is off", () => {
    expect(evaluateFlag({ ...base, isOn: false }, { key: "u1" })).toBe(false);
  });

  it("serves the off value when the flag is archived", () => {
    expect(evaluateFlag({ ...base, archived: true }, { key: "u1" })).toBe(false);
  });

  it("serves the default rule when on", () => {
    expect(evaluateFlag(base, { key: "u1" })).toBe(true);
  });

  it("matches a rule on the user key", () => {
    const flag: FlagConfig = {
      ...base,
      rules: [
        { id: "r1", clauses: [{ attribute: "key", operator: "is", values: ["user-12"] }], serve: { variationId: "off" } },
        ...base.rules,
      ],
    };
    expect(evaluateFlag(flag, { key: "user-12" })).toBe(false);
    expect(evaluateFlag(flag, { key: "user-13" })).toBe(true);
  });

  it("checks rules top to bottom with AND between clauses", () => {
    const flag: FlagConfig = {
      ...base,
      rules: [
        {
          id: "r1",
          clauses: [
            { attribute: "country", operator: "is", values: ["IL"] },
            { attribute: "plan", operator: "is", values: ["pro"] },
          ],
          serve: { variationId: "on" },
        },
        { id: "r2", clauses: [{ attribute: "email", operator: "endsWith", values: ["@acme.com"] }], serve: { variationId: "on" } },
        { id: "default", clauses: [], serve: { variationId: "off" } },
      ],
    };

    expect(evaluateFlag(flag, { key: "a", country: "IL", plan: "pro" })).toBe(true);
    expect(evaluateFlag(flag, { key: "b", country: "IL", plan: "free" })).toBe(false);
    expect(evaluateFlag(flag, { key: "c", email: "Emma@ACME.com" })).toBe(true);
    expect(evaluateFlag(flag, { key: "d" })).toBe(false);
  });

  it("splits a rollout by stable buckets", () => {
    const flag: FlagConfig = {
      ...base,
      rules: [
        {
          id: "default",
          clauses: [],
          serve: {
            rollout: [
              { variationId: "on", weight: 20 },
              { variationId: "off", weight: 80 },
            ],
          },
        },
      ],
    };

    const results = Array.from({ length: 5000 }, (_, i) => evaluateFlag(flag, { key: `user-${i}` }));
    const onShare = results.filter(Boolean).length / results.length;

    expect(onShare).toBeGreaterThan(0.17);
    expect(onShare).toBeLessThan(0.23);
    expect(evaluateFlag(flag, { key: "user-7" })).toBe(evaluateFlag(flag, { key: "user-7" }));
  });

  it("hashToPercent stays in range", () => {
    for (const key of ["a", "b", "new-checkout.user-1", ""]) {
      const value = hashToPercent(key);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(100);
    }
  });
});
