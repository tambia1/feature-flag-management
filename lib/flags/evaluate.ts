import { RE2JS } from "re2js";
import type { Clause, EvaluationContext, EvaluationResult, FlagConfig, JsonValue, Serve } from "@/app/types";

export function evaluateFlagDetail(flag: FlagConfig, context: EvaluationContext): EvaluationResult {
  const variationValue = (id: string) => flag.variations.find((variation) => variation.id === id)?.value ?? null;
  const offValue = variationValue(flag.offVariationId);

  if (flag.archived || !flag.isOn) {
    return { value: offValue, reason: { kind: "OFF" } };
  }

  for (const [index, rule] of flag.rules.entries()) {
    if (rule.clauses.every((clause) => matchesClause(clause, context))) {
      return {
        value: variationValue(pickVariation(rule.serve, flag.key, context.key)),
        reason: rule.clauses.length === 0 ? { kind: "DEFAULT_RULE" } : { kind: "RULE_MATCH", ruleId: rule.id, ruleNumber: index + 1 },
      };
    }
  }

  return { value: offValue, reason: { kind: "NO_MATCH" } };
}

export function evaluateFlag(flag: FlagConfig, context: EvaluationContext): JsonValue {
  return evaluateFlagDetail(flag, context).value;
}

export function getFlagResults(flags: FlagConfig[], context: EvaluationContext): Record<string, EvaluationResult> {
  return Object.fromEntries(flags.map((flag) => [flag.key, evaluateFlagDetail(flag, context)]));
}

function matchesClause(clause: Clause, context: EvaluationContext): boolean {
  const actual = clause.attribute === "key" ? context.key : context[clause.attribute];

  if (actual === undefined || actual === null || typeof actual === "object") {
    return clause.operator === "isNot";
  }

  const text = String(actual);

  switch (clause.operator) {
    case "is":
      return clause.values.some((value) => value === text);
    case "isNot":
      return clause.values.every((value) => value !== text);
    case "contains":
      return clause.values.some((value) => text.includes(value));
    case "startsWith":
      return clause.values.some((value) => text.startsWith(value));
    case "endsWith":
      return clause.values.some((value) => text.endsWith(value));
    case "greaterThan":
      return clause.values.some((value) => Number(text) > Number(value));
    case "lessThan":
      return clause.values.some((value) => Number(text) < Number(value));
    case "matches":
      return clause.values.some((value) => compilePattern(value)?.test(text) ?? false);
  }
}

const patterns = new Map<string, RE2JS | null>();

function compilePattern(pattern: string): RE2JS | null {
  if (!patterns.has(pattern)) {
    if (patterns.size >= 1000) {
      patterns.clear();
    }

    patterns.set(pattern, isValidPattern(pattern) ? RE2JS.compile(pattern) : null);
  }

  return patterns.get(pattern) ?? null;
}

export function isValidPattern(pattern: string): boolean {
  try {
    RE2JS.compile(pattern);
    return true;
  } catch {
    return false;
  }
}

function pickVariation(serve: Serve, flagKey: string, userKey: string): string {
  if ("variationId" in serve) {
    return serve.variationId;
  }

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

export function hashToPercent(input: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return ((hash >>> 0) % 10000) / 100;
}
