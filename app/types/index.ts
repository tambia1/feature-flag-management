export type CompanyRole = "ADMIN" | "MEMBER";
export type EnvironmentRole = "VIEWER" | "EDITOR";
export type RoleOrNone = EnvironmentRole | "NONE";
export type FlagType = "BOOLEAN" | "STRING" | "NUMBER" | "JSON";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** The logged-in user, as every page and action sees it. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  companyId: string;
  companyName: string;
  isPlatformAdmin: boolean;
};

export type Project = {
  id: string;
  name: string;
  key: string;
};

export type Environment = {
  id: string;
  projectId: string;
  name: string;
  key: string;
};

export type Variation = {
  id: string;
  value: JsonValue;
  order: number;
};

/** Attributes the customer's app sends for one user. `key` identifies the user. */
export type EvaluationContext = {
  key: string;
  [attribute: string]: JsonValue | undefined;
};

export type ClauseOperator = "is" | "isNot" | "contains" | "startsWith" | "endsWith" | "greaterThan" | "lessThan";

/** One condition. `values` are ORed: "country is IL or US". */
export type Clause = {
  attribute: string;
  operator: ClauseOperator;
  values: string[];
};

type Rollout = { variationId: string; weight: number }[];

/** Serve one variation, or split users between variations by percentage (weights add up to 100). */
export type Serve = { variationId: string } | { rollout: Rollout };

/** Clauses inside a rule are ANDed; rules are checked top to bottom. The last rule has no clauses = default rule. */
export type Rule = {
  id: string;
  clauses: Clause[];
  serve: Serve;
};

/** Individual targets: these user keys always get this variation. */
export type Target = {
  variationId: string;
  keys: string[];
};

/** Everything evaluation needs for one flag in one environment. */
export type FlagConfig = {
  key: string;
  archived: boolean;
  isOn: boolean;
  offVariationId: string;
  variations: Variation[];
  targets: Target[];
  rules: Rule[];
};

export type FormState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};
