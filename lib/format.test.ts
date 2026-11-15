import { describe, expect, it } from "vitest";
import { formatWhen } from "./format";

describe("formatWhen", () => {
  const now = new Date(2026, 10, 15, 12, 0);

  it("uses Today / Yesterday for recent entries", () => {
    expect(formatWhen(new Date(2026, 10, 15, 10, 42), now)).toBe("Today 10:42");
    expect(formatWhen(new Date(2026, 10, 14, 9, 5), now)).toBe("Yesterday 09:05");
  });

  it("uses a short date for older entries, with the year when it differs", () => {
    expect(formatWhen(new Date(2026, 0, 4), now)).toBe("Jan 4");
    expect(formatWhen(new Date(2025, 0, 4), now)).toBe("Jan 4, 2025");
  });
});
