import type { EvaluationReason } from "@/app/types";

export function describeReason(reason: EvaluationReason): string {
  switch (reason.kind) {
    case "OFF":
      return "Flag is off";
    case "RULE_MATCH":
      return `Rule ${reason.ruleNumber} matched`;
    case "DEFAULT_RULE":
      return "Default rule";
    case "NO_MATCH":
      return "No rule matched";
  }
}
