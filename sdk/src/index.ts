/**
 * Feature flag SDK for customer apps (browser or Node 18+).
 *
 *   const flags = createFlagClient({ baseUrl: "https://flags.example.com", sdkKey: "sdk-…", context: { key: "user-42", country: "IL" } });
 *   await flags.ready;
 *   if (flags.getFlag("new-checkout", false)) { … }
 *
 * It never throws: if the server is down it keeps the last values it got, and before that the fallback in your code.
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type FlagContext = { key: string; [attribute: string]: string | number | boolean | null };

export type FlagClientOptions = {
  baseUrl: string;
  sdkKey: string;
  context: FlagContext;
  /** Listen for changes and refetch right away (default true). */
  stream?: boolean;
  onError?: (error: unknown) => void;
};

export type FlagClient = {
  /** Resolves after the first fetch (or its failure). */
  ready: Promise<void>;
  getFlag<T extends JsonValue>(key: string, fallback: T): T;
  allFlags(): Record<string, JsonValue>;
  /** Called after values change. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void;
  /** Use another user/context, e.g. after login. */
  identify(context: FlagContext): Promise<void>;
  close(): void;
};

export function createFlagClient(options: FlagClientOptions): FlagClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const listeners = new Set<() => void>();
  let values: Record<string, JsonValue> = {};
  let context = options.context;
  let closed = false;
  let streamAbort: AbortController | null = null;

  const report = (error: unknown) => {
    try {
      options.onError?.(error);
    } catch {
      // never let a listener break the app
    }
  };

  const refresh = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/sdk/evaluate`, {
        method: "POST",
        headers: { Authorization: options.sdkKey, "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) {
        throw new Error(`Flag evaluate failed: ${response.status}`);
      }

      values = (await response.json()) as Record<string, JsonValue>;
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          report(error);
        }
      });
    } catch (error) {
      // Keep the last values.
      report(error);
    }
  };

  const listen = async (attempt = 0): Promise<void> => {
    if (closed) return;
    streamAbort = new AbortController();

    try {
      const response = await fetch(`${baseUrl}/api/sdk/stream`, {
        headers: { Authorization: options.sdkKey },
        signal: streamAbort.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Flag stream failed: ${response.status}`);
      }

      attempt = 0;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        let end: number;
        while ((end = buffer.indexOf("\n\n")) !== -1) {
          const message = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);

          if (/^event: changed$/m.test(message)) {
            await refresh();
          }
        }
      }
    } catch (error) {
      if (closed) return;
      report(error);
    }

    // Reconnect with backoff (max 30s); fetch again in case we missed a change.
    const delay = Math.min(30_000, 1000 * 2 ** attempt);
    setTimeout(() => {
      if (!closed) {
        void refresh();
        void listen(attempt + 1);
      }
    }, delay);
  };

  const ready = refresh();

  if (options.stream !== false) {
    void ready.then(() => listen());
  }

  return {
    ready,
    getFlag<T extends JsonValue>(key: string, fallback: T): T {
      return key in values ? (values[key] as T) : fallback;
    },
    allFlags: () => ({ ...values }),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async identify(next) {
      context = next;
      await refresh();
    },
    close() {
      closed = true;
      streamAbort?.abort();
      listeners.clear();
    },
  };
}
