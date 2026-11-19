import { describe, expect, it } from "vitest";
import { openStreamsByEnvironment, trackStream } from "./streams";

describe("trackStream", () => {
  it("counts open streams per environment and application", () => {
    const closeA = trackStream("env-1", "web");
    const closeB = trackStream("env-1", "web");
    const closeC = trackStream("env-1", "ios");

    expect(openStreamsByEnvironment()["env-1"]).toEqual({ web: 2, ios: 1 });

    closeA();
    closeC();
    expect(openStreamsByEnvironment()["env-1"]).toEqual({ web: 1 });

    closeB();
    expect(openStreamsByEnvironment()).not.toHaveProperty("env-1");
  });

  it("only counts a stream once when it is closed twice", () => {
    const close = trackStream("env-2", "web");
    const keep = trackStream("env-2", "web");

    close();
    close();
    expect(openStreamsByEnvironment()["env-2"]).toEqual({ web: 1 });

    keep();
  });
});
