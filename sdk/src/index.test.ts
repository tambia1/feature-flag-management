import { afterEach, describe, expect, it, vi } from "vitest";
import { createFlagClient } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("createFlagClient", () => {
  it("serves values from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async () => Response.json({ "new-checkout": true })),
    );
    const client = createFlagClient({ baseUrl: "http://flags", sdkKey: "sdk-1", context: { key: "u1" }, stream: false });
    await client.ready;

    expect(client.getFlag("new-checkout", false)).toBe(true);
    expect(client.getFlag("missing", "fallback")).toBe("fallback");
  });

  it("never throws: uses the fallback when the server is down", async () => {
    const onError = vi.fn<(error: unknown) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async () => {
        throw new Error("offline");
      }),
    );
    const client = createFlagClient({ baseUrl: "http://flags", sdkKey: "sdk-1", context: { key: "u1" }, stream: false, onError });
    await client.ready;

    expect(client.getFlag("new-checkout", false)).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it("keeps the last values when a later fetch fails", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => Response.json({ banner: "Welcome!" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createFlagClient({ baseUrl: "http://flags", sdkKey: "sdk-1", context: { key: "u1" }, stream: false });
    await client.ready;

    fetchMock.mockImplementationOnce(async () => new Response("down", { status: 503 }));
    await client.identify({ key: "u2" });

    expect(client.getFlag("banner", "")).toBe("Welcome!");
  });
});
