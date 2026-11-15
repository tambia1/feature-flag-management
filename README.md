# Feature Flag Management

Turn features on and off per environment without deploying. Platform admins manage companies; company admins manage
users, teams, projects and environments; teams get a viewer / editor role per environment; customer apps read flag values
through the SDK. The design is in [docs/systemDesign.pdf](docs/systemDesign.pdf).

## Getting started

Needs Node 24 and Postgres (Redis is optional).

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL, BETTER_AUTH_SECRET and SEED_ADMIN_PASSWORD
npm run db:migrate            # creates the database and tables
SEED_DEMO=1 npm run db:seed   # platform admin + demo company "Acme"
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in as `SEED_ADMIN_EMAIL` (platform admin). With `SEED_DEMO=1`
you can also log in as `emma@acme.com` (company admin, editor), `james@acme.com` (viewer in production) or
`liam@acme.com` (no team → no-access message), all with `SEED_ADMIN_PASSWORD`.

No Postgres? `docker compose up -d db redis` starts both (user/password `postgres`).

## Scripts

| Command                                        | What it does                                                 |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                                  | Dev server on port 3000                                      |
| `npm run build` / `npm start`                  | Production build / server                                    |
| `npm run check`                                | Lint + format check + typecheck + unit tests + unused code   |
| `npm test`                                     | Unit and component tests (Vitest, Testing Library)           |
| `npm run test:e2e`                             | End-to-end tests (Playwright; seed with `SEED_DEMO=1` first) |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations (dev / production) and seed                |

## Using flags from an app (SDK)

Every environment has its own SDK key (Settings → Projects). See [sdk/src/index.ts](sdk/src/index.ts):

```ts
import { createFlagClient } from "@feature-flags/sdk";

const flags = createFlagClient({ baseUrl: "https://flags.example.com", sdkKey: "sdk-…", context: { key: "user-42", country: "IL" } });
await flags.ready;
if (flags.getFlag("new-checkout", false)) showNewCheckout();
```

Raw API: `POST /api/sdk/evaluate` with `Authorization: <sdkKey>` and body `{ "context": { "key": "user-42", … } }` returns
`{ "flag-key": value, … }`. `GET /api/sdk/stream` is a Server-Sent Events stream that sends `changed` when a flag in the
environment changes. The SDK never throws: it keeps the last values, then falls back to the value in your code.

## How it fits together

- **Next.js App Router**: Server Components read data, forms use Server Actions (`useActionState`), every action checks
  the session, role and company on the server (`lib/session.ts`, `lib/permissions.ts`). The company always comes from the
  session, never from the URL or form.
- **Auth**: Better Auth with email + password and database sessions (no public sign-up; admins create users).
- **Flags**: `Flag` + `Variation` are shared by all environments; `FlagEnvironment` holds on/off, the off value, individual
  targets and rules per environment. Evaluation is in `lib/flags/evaluate.ts`.
- **Change flow**: save → Postgres → publish "flag changed" (Redis pub/sub when `REDIS_URL` is set, in-process otherwise)
  → every server clears its in-memory flag cache → pushes `changed` to open SDK streams → apps fetch new values.
- **Logs**: every change is written to the append-only company log in the same transaction. Platform events go to the
  platform company's log.

## Observability (all optional, enabled by env vars)

| Tool                            | Env var                                   | Notes                                                          |
| ------------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Sentry (client + server errors) | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`    | User details, cookies and bodies are not sent                  |
| Logs: pino JSON → Loki          | `LOG_LEVEL`                               | Secrets and emails are redacted; set Loki retention to 90 days |
| Metrics: Prometheus + Grafana   | `METRICS_TOKEN` (protects `/api/metrics`) | Alerts in `ops/prometheus/alerts.yml`                          |
| Traces: OpenTelemetry → Tempo   | `OTEL_EXPORTER_OTLP_ENDPOINT`             |                                                                |
| Product analytics: PostHog      | `NEXT_PUBLIC_POSTHOG_KEY`                 | Key events only, no personal data                              |
| Uptime: Uptime Kuma             | —                                         | Point it at `/api/health` every minute                         |

`docker compose --profile full up -d` runs two app servers behind Nginx (port 8080) with Postgres, Redis, Loki, Prometheus,
Grafana (port 3200), Tempo and Uptime Kuma (port 3300).

## CI/CD

- `.github/workflows/ci.yml` (every PR and the merge queue): lint, format, typecheck, Prisma validate + migration check, unit
  tests, unused code, build, integration tests against a real Postgres; then a preview deploy + Playwright against it when
  `PREVIEW_DEPLOY_ENABLED` is set.
- `.github/workflows/deploy.yml` (merge to master): tests, deploy to AWS (`ops/deploy.sh`: Docker → ECR → migrations →
  ECS), Slack message on success or failure.

The AWS resources (ECR, ECS cluster and services, ALB, RDS, ElastiCache, CloudFront, Route 53) are not created by this
repo; set their names as GitHub variables/secrets (see `ops/deploy.sh`).
