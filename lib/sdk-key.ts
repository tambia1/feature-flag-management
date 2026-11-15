/** Creates a new random SDK key. */
export function generateSdkKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `sdk-${Buffer.from(bytes).toString("base64url")}`;
}

/** Shows only the end of a key, e.g. sdk-••••4f2a. */
export function maskSdkKey(sdkKey: string): string {
  return `sdk-••••${sdkKey.slice(-4)}`;
}
