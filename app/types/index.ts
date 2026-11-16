export type CompanyRole = "ADMIN" | "MEMBER";
export type EnvironmentRole = "VIEWER" | "EDITOR";
export type RoleOrNone = EnvironmentRole | "NONE";
export type FlagType = "BOOLEAN" | "STRING" | "NUMBER" | "JSON";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  companyId: string;
  companyName: string;
  companyIconUrl: string | null;
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

export type EvaluationContext = {
  key: string;
  [attribute: string]: JsonValue | undefined;
};

export type ClauseOperator = "is" | "isNot" | "contains" | "startsWith" | "endsWith" | "greaterThan" | "lessThan";

export type Clause = {
  attribute: string;
  operator: ClauseOperator;
  values: string[];
};

type Rollout = { variationId: string; weight: number }[];

export type Serve = { variationId: string } | { rollout: Rollout };

export type Rule = {
  id: string;
  clauses: Clause[];
  serve: Serve;
};

export type FlagConfig = {
  key: string;
  archived: boolean;
  isOn: boolean;
  offVariationId: string;
  variations: Variation[];
  rules: Rule[];
};

export type FormState = {
  error?: string;
  success?: string;
  values?: Record<string, string>;
};

export type ActivityKey = "users" | "projects" | "teams" | "operations";

export type CompanyActivity = {
  months: string[];
  series: { key: ActivityKey; label: string; values: number[] }[];
};

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export type ServerStatus = {
  id: string;
  host: string;
  pid: number;
  startedAt: number;
  reportedAt: number;
  openStreams: number;
  requestsPerSecond: number;
  averageResponseMs: number | null;
  errors: number;
  rateLimited: number;
  memoryMb: number;
  eventLoopDelayMs: number;
};

export type ServiceState = "up" | "down" | "off";

export type ServiceCheck = {
  name: string;
  state: ServiceState;
  detail: string;
};
