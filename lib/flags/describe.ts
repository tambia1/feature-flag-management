import type { Clause, JsonValue, Rule, Serve, Variation } from "@/app/types";
import { formatValue } from "./values";

export const OPERATOR_LABELS: Record<Clause["operator"], string> = {
  is: "is",
  isNot: "is not",
  contains: "contains",
  startsWith: "starts with",
  endsWith: "ends with",
  greaterThan: "greater than",
  lessThan: "less than",
};

export type TargetingSnapshot = {
  isOn: boolean;
  offVariationId: string;
  rules: Rule[];
};

function valueOf(variations: Variation[], id: string): string {
  const variation = variations.find((item) => item.id === id);
  return variation ? formatValue(variation.value as JsonValue) : "?";
}

function describeServe(serve: Serve, variations: Variation[]): string {
  if ("variationId" in serve) {
    return valueOf(variations, serve.variationId);
  }

  return serve.rollout.map((part) => `${part.weight}% ${valueOf(variations, part.variationId)}`).join(" · ");
}

function describeClauses(clauses: Clause[]): string {
  return clauses.map((clause) => `${clause.attribute} ${OPERATOR_LABELS[clause.operator]} ${clause.values.join(" or ")}`).join("  AND  ");
}

export function describeTargetingChange(before: TargetingSnapshot, after: TargetingSnapshot, variations: Variation[]): string {
  const changes: string[] = [];

  if (before.isOn !== after.isOn) {
    changes.push(after.isOn ? "turned on" : "turned off");
  }

  if (before.offVariationId !== after.offVariationId) {
    changes.push(`off value: ${valueOf(variations, before.offVariationId)} → ${valueOf(variations, after.offVariationId)}`);
  }

  const beforeRules = before.rules.slice(0, -1);
  const afterRules = after.rules.slice(0, -1);

  if (afterRules.length > beforeRules.length) {
    changes.push(`added rule ${afterRules.length}`);
  } else if (afterRules.length < beforeRules.length) {
    changes.push("removed a rule");
  } else if (JSON.stringify(beforeRules) !== JSON.stringify(afterRules)) {
    changes.push("edited rules");
  }

  const beforeDefault = before.rules.at(-1);
  const afterDefault = after.rules.at(-1);

  if (beforeDefault && afterDefault && JSON.stringify(beforeDefault.serve) !== JSON.stringify(afterDefault.serve)) {
    changes.push(`default rule: ${describeServe(beforeDefault.serve, variations)} → ${describeServe(afterDefault.serve, variations)}`);
  }

  return changes.join(" · ") || "no changes";
}

export function describeTargeting(snapshot: TargetingSnapshot, variations: Variation[]): string[] {
  const lines = [`${snapshot.isOn ? "On" : "Off"} · off value ${valueOf(variations, snapshot.offVariationId)}`];

  snapshot.rules.forEach((rule, index) => {
    lines.push(
      rule.clauses.length > 0
        ? `${index + 1}. IF ${describeClauses(rule.clauses)} → ${describeServe(rule.serve, variations)}`
        : `default rule ${describeServe(rule.serve, variations)}`,
    );
  });

  return lines;
}
