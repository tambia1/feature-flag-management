import { describe, expect, it } from "vitest";
import type { Variation } from "@/app/types";
import { describeTargeting, describeTargetingChange, type TargetingSnapshot } from "./describe";

const variations: Variation[] = [
  { id: "t", value: true, order: 0 },
  { id: "f", value: false, order: 1 },
];

const base: TargetingSnapshot = {
  isOn: false,
  offVariationId: "f",
  rules: [{ id: "default", clauses: [], serve: { variationId: "t" } }],
};

describe("describeTargetingChange", () => {
  it("summarises what changed for the log", () => {
    const after: TargetingSnapshot = {
      ...base,
      isOn: true,
      rules: [
        { id: "r1", clauses: [{ attribute: "email", operator: "endsWith", values: ["@acme.com"] }], serve: { variationId: "t" } },
        {
          id: "default",
          clauses: [],
          serve: {
            rollout: [
              { variationId: "t", weight: 20 },
              { variationId: "f", weight: 80 },
            ],
          },
        },
      ],
    };

    expect(describeTargetingChange(base, after, variations)).toBe("turned on · added rule 1 · default rule: true → 20% true · 80% false");
  });

  it("says when nothing changed", () => {
    expect(describeTargetingChange(base, base, variations)).toBe("no changes");
  });
});

describe("describeTargeting", () => {
  it("lists rules and the default rule", () => {
    const lines = describeTargeting(
      {
        ...base,
        rules: [
          { id: "r1", clauses: [{ attribute: "country", operator: "is", values: ["IL", "US"] }], serve: { variationId: "t" } },
          ...base.rules,
        ],
      },
      variations,
    );

    expect(lines).toEqual(["Off · off value false", "1. IF country is IL or US → true", "default rule true"]);
  });
});
