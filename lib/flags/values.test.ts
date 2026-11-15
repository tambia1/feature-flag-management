import { describe, expect, it } from "vitest";
import { formatValue, KEY_PATTERN, parseVariationValue } from "./values";

describe("parseVariationValue", () => {
  it("parses each flag type", () => {
    expect(parseVariationValue("BOOLEAN", "true")).toBe(true);
    expect(parseVariationValue("NUMBER", " 25 ")).toBe(25);
    expect(parseVariationValue("JSON", '{"a":1}')).toEqual({ a: 1 });
    expect(parseVariationValue("STRING", " Big sale ")).toBe(" Big sale ");
  });

  it("rejects values of the wrong type with a readable message", () => {
    expect(() => parseVariationValue("BOOLEAN", "yes")).toThrow("true or false");
    expect(() => parseVariationValue("NUMBER", "abc")).toThrow("not a number");
    expect(() => parseVariationValue("NUMBER", "")).toThrow("not a number");
    expect(() => parseVariationValue("JSON", "{oops")).toThrow("not valid JSON");
  });
});

describe("formatValue", () => {
  it("shows strings as-is and everything else as JSON", () => {
    expect(formatValue("Welcome!")).toBe("Welcome!");
    expect(formatValue(false)).toBe("false");
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("KEY_PATTERN", () => {
  it("accepts lowercase keys with dashes only", () => {
    expect(KEY_PATTERN.test("new-checkout")).toBe(true);
    expect(KEY_PATTERN.test("New-Checkout")).toBe(false);
    expect(KEY_PATTERN.test("-start")).toBe(false);
    expect(KEY_PATTERN.test("double--dash")).toBe(false);
  });
});
