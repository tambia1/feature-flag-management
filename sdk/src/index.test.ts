import { afterEach, describe, expect, it, vi } from "vitest";
import { createFlagClient } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("createFlagClient", () => {
  it("serves values from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async () => Response.json({ "new-checkout": true })),
    );
    const client = createFlagClient({ baseUrl: "http://flags", envSdkKey: "sdk-1", context: { key: "u1" }, isLiveUpdate: false });
    await client.ready;

    expect(client.getFlag("new-checkout", false)).toBe(true);
    expect(client.getFlag("missing", "fallback")).toBe("fallback");
  });

  it("sends the application name with the context", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    const client = createFlagClient({
      baseUrl: "http://flags",
      envSdkKey: "sdk-1",
      context: { key: "u1" },
      applicationName: "checkout-web",
      isLiveUpdate: false,
    });
    await client.ready;

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ context: { key: "u1" }, applicationName: "checkout-web" });
  });

  it("marks fetches after a flag change as a refresh", async () => {
    const encoder = new TextEncoder();
    const bodies: unknown[] = [];
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      if (String(url).endsWith("/api/sdk/flags")) {
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({});
      }
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode("event: changed\ndata: {}\n\n"));
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = createFlagClient({ baseUrl: "http://flags", envSdkKey: "sdk-1", context: { key: "u1" } });
    await client.ready;
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    client.close();

    expect(bodies).toEqual([{ context: { key: "u1" } }, { context: { key: "u1" }, refresh: true }]);
  });

  it("never throws: uses the fallback when the server is down", async () => {
    const onError = vi.fn<(error: unknown) => void>();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async () => {
        throw new Error("offline");
      }),
    );
    const client = createFlagClient({ baseUrl: "http://flags", envSdkKey: "sdk-1", context: { key: "u1" }, isLiveUpdate: false, onError });
    await client.ready;

    expect(client.getFlag("new-checkout", false)).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it("keeps the last values when a later fetch fails", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => Response.json({ banner: "Welcome!" }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createFlagClient({ baseUrl: "http://flags", envSdkKey: "sdk-1", context: { key: "u1" }, isLiveUpdate: false });
    await client.ready;

    fetchMock.mockImplementationOnce(async () => new Response("down", { status: 503 }));
    await client.identify({ key: "u2" });

    expect(client.getFlag("banner", "")).toBe("Welcome!");
  });
});
