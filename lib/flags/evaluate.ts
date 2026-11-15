import type { Clause, EvaluationContext, FlagConfig, JsonValue, Serve } from "@/app/types";

/**
 * Picks the value one user gets for one flag:
 * archived or off → off value; individual target → its value; first matching rule → its value.
 */
export function evaluateFlag(flag: FlagConfig, context: EvaluationContext): JsonValue {
  const variationValue = (id: string) => flag.variations.find((variation) => variation.id === id)?.value ?? null;
  const offValue = variationValue(flag.offVariationId);

  if (flag.archived || !flag.isOn) {
    return offValue;
  }

  for (const target of flag.targets) {
    if (target.keys.includes(context.key)) {
      return variationValue(target.variationId);
    }
  }

  for (const rule of flag.rules) {
    if (rule.clauses.every((clause) => matchesClause(clause, context))) {
      return variationValue(pickVariation(rule.serve, flag.key, context.key));
    }
  }

  return offValue;
}

export function evaluateAll(flags: FlagConfig[], context: EvaluationContext): Record<string, JsonValue> {
  return Object.fromEntries(flags.map((flag) => [flag.key, evaluateFlag(flag, context)]));
}

function matchesClause(clause: Clause, context: EvaluationContext): boolean {
  const actual = clause.attribute === "key" ? context.key : context[clause.attribute];

  if (actual === undefined || actual === null || typeof actual === "object") {
    return clause.operator === "isNot";
  }

  const text = String(actual);
  const lower = text.toLowerCase();

  switch (clause.operator) {
    case "is":
      return clause.values.some((value) => value === text);
    case "isNot":
      return clause.values.every((value) => value !== text);
    case "contains":
      return clause.values.some((value) => lower.includes(value.toLowerCase()));
    case "startsWith":
      return clause.values.some((value) => lower.startsWith(value.toLowerCase()));
    case "endsWith":
      return clause.values.some((value) => lower.endsWith(value.toLowerCase()));
    case "greaterThan":
      return clause.values.some((value) => Number(text) > Number(value));
    case "lessThan":
      return clause.values.some((value) => Number(text) < Number(value));
  }
}

function pickVariation(serve: Serve, flagKey: string, userKey: string): string {
  if ("variationId" in serve) {
    return serve.variationId;
  }

  // The same user always lands in the same bucket for this flag, so a rollout is stable.
  const bucket = hashToPercent(`${flagKey}.${userKey}`);
  let total = 0;

  for (const part of serve.rollout) {
    total += part.weight;

    if (bucket < total) {
      return part.variationId;
    }
  }

  return serve.rollout.at(-1)?.variationId ?? "";
}

/** Stable hash (FNV-1a) of a string to a number in [0, 100). */
export function hashToPercent(input: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return ((hash >>> 0) % 10000) / 100;
}
