import type { EnvironmentRole, RoleOrNone } from "@/app/types";

const RANK: Record<RoleOrNone, number> = { NONE: 0, VIEWER: 1, EDITOR: 2 };

export function highestRole(roles: RoleOrNone[]): RoleOrNone {
  return roles.reduce<RoleOrNone>((best, role) => (RANK[role] > RANK[best] ? role : best), "NONE");
}

export function roleAllows(role: RoleOrNone, needed: EnvironmentRole): boolean {
  return RANK[role] >= RANK[needed];
}
