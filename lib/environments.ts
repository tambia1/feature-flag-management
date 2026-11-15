/** Production is shown in red so nobody changes it by accident. */
export function isProduction(environment: { key: string; name: string }): boolean {
  return environment.key === "prod" || environment.key === "production" || environment.name.toLowerCase() === "production";
}

/** The project key from a /projects/[projectKey]/... path, or null. */
export function projectKeyFromPath(pathname: string): string | null {
  return pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;
}
