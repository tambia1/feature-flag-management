import type { FlagType, JsonValue } from "@/app/types";

/** Turns what the user typed into a variation value of the flag's type, or throws a readable error. */
export function parseVariationValue(type: FlagType, raw: string): JsonValue {
  const text = raw.trim();

  switch (type) {
    case "BOOLEAN":
      if (text !== "true" && text !== "false") {
        throw new Error("Boolean values must be true or false");
      }
      return text === "true";
    case "NUMBER": {
      const number = Number(text);
      if (text === "" || Number.isNaN(number)) {
        throw new Error(`"${raw}" is not a number`);
      }
      return number;
    }
    case "JSON":
      try {
        return JSON.parse(text) as JsonValue;
      } catch {
        throw new Error(`"${raw}" is not valid JSON`);
      }
    case "STRING":
      return raw;
  }
}

/** Shows a variation value in the UI and in logs. */
export function formatValue(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export const FLAG_TYPES: { value: FlagType; label: string }[] = [
  { value: "BOOLEAN", label: "boolean" },
  { value: "STRING", label: "string" },
  { value: "NUMBER", label: "number" },
  { value: "JSON", label: "JSON" },
];

/** Keys are used in code: lowercase letters, numbers and dashes. */
export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
