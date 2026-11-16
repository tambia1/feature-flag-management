import { describe, expect, it } from "vitest";
import { formatDuration, formatWhen } from "./format";

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

describe("formatDuration", () => {
  it("shows the two largest units", () => {
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(12 * 60_000 + 5_000)).toBe("12m");
    expect(formatDuration((3 * 60 + 5) * 60_000)).toBe("3h 5m");
    expect(formatDuration((2 * 24 + 4) * 3_600_000)).toBe("2d 4h");
  });
});
