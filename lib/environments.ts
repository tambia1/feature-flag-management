export function isProduction(environment: { key: string; name: string }): boolean {
  return environment.key === "prod" || environment.key === "production" || environment.name.toLowerCase() === "production";
}

export function projectKeyFromPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;
}
