import type { FlagType, JsonValue } from "@/app/types";

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

export function formatValue(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export const FLAG_TYPES: { value: FlagType; label: string }[] = [
  { value: "BOOLEAN", label: "boolean" },
  { value: "STRING", label: "string" },
  { value: "NUMBER", label: "number" },
  { value: "JSON", label: "JSON" },
];

export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
