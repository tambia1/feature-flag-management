export function generateSdkKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `sdk-${Buffer.from(bytes).toString("base64url")}`;
}

export function maskSdkKey(sdkKey: string): string {
  return `sdk-••••${sdkKey.slice(-4)}`;
}
