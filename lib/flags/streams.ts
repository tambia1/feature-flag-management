type OpenStreams = Map<string, Map<string, number>>;

const globalForStreams = globalThis as unknown as { openStreams?: OpenStreams };
const openStreams = (globalForStreams.openStreams ??= new Map());

export function trackStream(environmentId: string, applicationName: string): () => void {
  const byApplication = openStreams.get(environmentId) ?? new Map<string, number>();
  byApplication.set(applicationName, (byApplication.get(applicationName) ?? 0) + 1);
  openStreams.set(environmentId, byApplication);

  let open = true;

  return () => {
    if (!open) {
      return;
    }

    open = false;
    const count = (byApplication.get(applicationName) ?? 1) - 1;

    if (count > 0) {
      byApplication.set(applicationName, count);
    } else {
      byApplication.delete(applicationName);
    }

    if (byApplication.size === 0) {
      openStreams.delete(environmentId);
    }
  };
}

export function openStreamsByEnvironment(): Record<string, Record<string, number>> {
  return Object.fromEntries([...openStreams].map(([environmentId, byApplication]) => [environmentId, Object.fromEntries(byApplication)]));
}
