# System Design - Feature Flag Management

Prompt:
We need a "feature flag management" web app.
The app is managed by our team (the platform admins), who can add and remove companies, each with a company admin.
A company admin can create projects, environments, teams and users for their company.
Each team gets permissions per environment (viewer / editor).
Users can manage flags (add / modify / archive / delete) in the environments their teams allow.
Each company's apps read the flag values through an SDK.

## 1. Requierements

### 1.1 Clarifications

- Is this a public app or internal?
  public - many companies, each sees only its own data
- Is our company also one of the companies?
  yes - it also manages the app: adding other companies
- How is the first platform admin created?
  by a seed script
- Who can sign up?
  no public sign-up - users are created by a company admin
- How do users join a company?
  admin creates the user with a password (the ui will help generate this)
  user can stay with it or change it, no need to track first login
- Can a user be in more than one company?
  no
- Can a user be in more than one team?
  yes - gets the highest role from their teams
- What can a member with no team do?
  nothing - sees a message to ask the admin to add them to a team
- What are teams for
  setting permissions per group
- Does a company have projects
  yes (multiple apps)
- Who creates projects?
  company admin
- Do environments belong to a project or to the company?
  project
- Who creates environments?
  company admin
- Can users turn flags on/off in production?
  production is just another environment - permissions are set per environment
- Where are roles set?
  company role: on the user (admin / member) - manages the company, not flags
  environment role: on the team (viewer / editor) - the only way to access flags, for admins too
- Can we delete flags?
  yes - archive first, then delete
- What does an app get for an archived flag?
  flag will have default value (the "off" value)
  if the flag is deleted or the service is down, the app uses the fallback value in its code
- Flag types?
  boolean, string, number, JSON
- Targeting?
  rules per environment: conditions on user attributes, AND / OR, specific users, % rollout
- Do we need a change history?
  yes - log: who changed what and when, with the value before and after
  flags, users / teams / permissions
  will need also companies added and removed by platform, so we need to keep this safe so company will see only its logs.
- Can a company have more than one admin?
  yes
- Who can add more platform admins?
  another platform admin
- Can the last admin be removed?
  no - a company must always have at least one admin (same for platform admins)

### 1.2 Functional requirements (user stories)

“As a [role], I can [action]”

- Platform admin
  1. As a platform admin, I can add a company with its first admin
  2. As a platform admin, I can remove a company
  3. As a platform admin, I can list companies
  4. As a platform admin, I can add other platform admins
  5. As a platform admin, I can see the platform log
- Company admin
  1. As a company admin, I can modify the company's profile details
  2. As a company admin, I can create a project
  3. As a company admin, I can create environments for each project
  4. As a company admin, I can create/delete/update users
  5. As a company admin, I can create teams and add users to them
  6. As a company admin, I can add/remove permission to each team
  7. As a company admin, I can edit and delete projects, environments and teams
  8. As a company admin, I can make a user an admin
  9. As a company admin, I can see and rotate SDK keys
  10. As a company admin, I can see the company log
  11. As a company admin, I can manage flags only if im in the right team
- Member
  1. As a member, I can create/archive/delete a flag in environments where my team is editor (no matter which environment - as long im editor in it)
  2. As a member, I can turn a flag on/off, set targeting rules, restore an archived flag, search and filter flags, see a flag’s history
- SDK (the company's app)
  1. As an app, I can get the flag values for a user in my environment
  2. As an app, I can authenticate with the environment key.
  3. As an app, I receive changes right away.
- Everyone
  1. log in, log out, change password, see my teams and permissions.
- Viewers
  1. view flags.

### 1.3 Non Functional

- Scale (assumptions)
  1,000 companies now, 10,000 in 5 years
  50K dashboard users
  SDK: 1,000 reads / sec average, 10,000 at peak
  Flag changes: ~0.1 / sec
  Read : write ≈ 10,000 : 1
- Performance
  SDK: get flag values in < 50ms
  Flag change reaches apps in < 5 seconds
  Dashboard: first page load < 2 seconds
- Availability
  SDK: 99.99% - if it's down, customers' apps are affected
  Dashboard: 99.9% - if it's down, only flag editing stops
  If the service is unreachable, the SDK keeps using the last values it got,
  and then the fallback in code
- Consistency or availability?
  SDK reads: availability - a value a few seconds old is fine
  Dashboard writes: consistency - last save wins,
  and no audit log entry may be lost
- Security
  Tenant isolation - a company can never see another company's data
  RBAC - roles per environment, through teams
  SDK keys per environment, can be rotated
  Passwords hashed; audit log can't be edited
- Storage
  Small (~12GB of flags, ~7GB of logs per year) - one Postgres database is enough
  Audit log kept for ( ? ) years
- SEO
  No - login required. Use SSR only where it makes pages faster
- Accessibility
  Yes - WCAG AA, keyboard navigation, screen readers
- Device support
  Desktop first; mobile must be able to turn a flag off (emergency kill switch)
- i18n
  English only at first

### 1.4 Constrains

- Frontend: React + Next.js + CSS Modules
- Language: TypeScript
- Database: Postgres + Prisma
- Hosting: AWS
- Team: 1 developer
- Timeline: first version in 1 week
- Budget: free tiers only at first
- Starting point: new repo

## 2. UI Wireframes

## 3. Data Models

## 4. API (REST)

### 4.1 AUTH

```
POST   /api/auth/login                             everyone
POST   /api/auth/logout                            logged in
GET    /api/me                                     logged in   current user
PATCH  /api/me/password                            logged in   change password
GET    /api/me/roles                               logged in   my teams + role per env
```

### 4.2 COMPANIES

```
GET    /api/companies                              platform admin
POST   /api/companies                              platform admin   + first admin
GET    /api/companies/:companyId                   platform admin (any) · company admin (own)
PATCH  /api/companies/:companyId                   platform admin (any) · company admin (own)
DELETE /api/companies/:companyId                   platform admin   (not the platform company)
```

### 4.3 USERS

```
GET    /api/users?search=                          company admin
POST   /api/users                                  company admin
PATCH  /api/users/:userId                          company admin   name, email, role, new password
DELETE /api/users/:userId                          company admin   (not the last admin)
```

### 4.4 TEAMS

```
GET    /api/teams                                  company admin
POST   /api/teams                                  company admin
PATCH  /api/teams/:teamId                          company admin   rename
DELETE /api/teams/:teamId                          company admin
GET    /api/teams/:teamId/members                  company admin
POST   /api/teams/:teamId/members                  company admin   { userId }
DELETE /api/teams/:teamId/members/:userId          company admin
GET    /api/teams/:teamId/permissions              company admin
PUT    /api/teams/:teamId/permissions              company admin   whole grid
```

### 4.5 PROJECTS & ENVIRONMENTS

```
GET    /api/projects                               logged in   (only projects I can access)
POST   /api/projects                               company admin
PATCH  /api/projects/:projectId                    company admin   rename
DELETE /api/projects/:projectId                    company admin
GET    /api/projects/:projectId/environments       logged in   (only envs I can access)
POST   /api/projects/:projectId/environments       company admin
PATCH  /api/environments/:environmentId            company admin   rename
DELETE /api/environments/:environmentId            company admin
POST   /api/environments/:environmentId/rotate-key company admin
```

### 4.6 FLAGS

```
GET    /api/projects/:projectId/flags?environmentId=&search=&status=&archived=
POST   /api/projects/:projectId/flags              editor   + variations + starting on/off
GET    /api/flags/:flagId                          viewer
PATCH  /api/flags/:flagId                          editor   name, description, variations
POST   /api/flags/:flagId/archive                  editor
POST   /api/flags/:flagId/restore                  editor
DELETE /api/flags/:flagId                          editor   (only if archived)
GET    /api/flags/:flagId/environments/:environmentId   viewer   on/off, off value, targets, rules
PATCH  /api/flags/:flagId/environments/:environmentId   editor   + comment
GET    /api/flags/:flagId/history?environmentId=   viewer
```

### 4.7 LOGS

```
GET    /api/logs?userId=&targetType=&from=&to=
```

### 4.8 SDK (used by the companies' apps, not the dashboard)

```
POST   /api/sdk/evaluate                           SDK key
       header: Authorization: <sdkKey>
       body:   { "context": { "key": "user-42", "country": "IL", "plan": "pro" } }
       reply:  { "new-checkout": true, "homepage-banner": "Big sale today!", … }

GET    /api/sdk/stream                             SDK key   real-time: "flags changed, fetch again"
```

### 4.9 OTHER

```
GET    /api/health                                 everyone   (load balancers, monitoring)
GET    /api/docs                                   dev only, Swagger UI
GET    /api/docs/spec                              dev only, OpenAPI spec (openapi.yaml)
```

### 4.10 Two rules every endpoint follows

- 401 if not logged in
- 403 if the role isn’t allowed

## 5. Database

1. Postgres + Prisma:
   - data is relational
   - non-functional requirements ask for consistency.
   - Small data: ~120GB in 5 years fits one server easily
2. CACHE: read heavy for flags - most reads never reaches database
3. S3: no need, this is for files like images, and videos.

## 6. Authentication & Authorization

1. Authentication (who are you)
   - Who can login ?
     all users need to be longed to use the app
   - email+pass
2. Authorization (what can you do)
   - Platform admin: ADMIN of the company with isPlatform = true
   - Company admin: User.role = ADMIN → manages users, teams, projects, envs, company
   - Flag access: only through teams: highest role (viewer/editor) per environment, admins included
   - Tenant isolation: company always taken from the session, never from the URL
   - Checked on the server for every request: 401 = not logged in, 403 = not allowed
   - The UI hides what you can't do, but the server is what enforces it
   - jwt or session? session
     1. Instant logout and revoke (if we delete a user)
     2. Simple and safe (using cookie holding random id)
     3. Speed isn’t a problem: the dashboard has low traffic, the SDK will be high

## 7. State management

1. Server data → Server Components (fetch on the server), re-fetch after changes
2. URL state → project, environment, filters, search, tabs (shareable, survives reload)
3. Session → server (cookie) → layout → small React context for client components
4. Local UI → useState in the owning component
5. Forms → useActionState + Server Actions
6. Optimistic UI → only the flag on/off toggle (useOptimistic, rollback on error)
7. No global store (Redux/Zustand) - not needed

## 8. Component Architecture

### 8.1 app/

```
app/
  (auth)/login/page.tsx
  (app)/layout.tsx                         Header + SideMenu (the Layout wireframe)
    projects/[projectKey]/
      flags/page.tsx                       Flags list   ?env=production&status=on
      flags/new/page.tsx                   Create flag
      flags/[flagKey]/layout.tsx           flag header + tabs
        page.tsx                           Targeting
        history/page.tsx                   History
        settings/page.tsx                  Settings
      archived/page.tsx                    Archived flags
    settings/
      company/page.tsx · users/page.tsx · teams/page.tsx · projects/page.tsx · log/page.tsx
    platform/
      companies/page.tsx · admins/page.tsx · log/page.tsx
    account/
      password/page.tsx · roles/page.tsx
  api/sdk/…                                SDK endpoints (route handlers)
```

### 8.2 layers

```
Pages (server)          fetch data, check permissions, compose features
Feature components      FlagTable, TargetingEditor, PermissionsGrid, UserRow…   (per screen)
Shared UI components    Button, Input, Field, Select, Table, Dialog, Toggle, Message…
```

## 9. CI/CD

1. On every pr
   - lint
   - format
   - typecheck (tsc)
   - prisma validate + migration check
   - unit tests
   - next build
   - integration test
   - preview deploy of the PR
   - e2e tests against the preview (Playwright)
2. Merge to master
   - run tests after merge to master (merge queue)
   - deploy
   - send message to slack channel (fail/success)

## 10. Observability

Goal: know about slowness or bugs before users report them — and never guess why

1. Errors: Sentry on client and server (mask user details - privacy)
2. Metrics:
   - SDK evaluate latency p99 < 50ms, availability 99.99%
   - flag change reaches apps < 5s
   - cache hit rate, open SDK stream connections
   - dashboard 5xx errors, first page load < 2s
   - Postgres: connections, slow queries, CPU, disk
3. Alerts:
   - urgent (page): SDK errors > 0.1% / p99 > 50ms / propagation > 5s
   - Slack: dashboard errors rising
   - external uptime check on /api/health every minute
4. Logs:
   - structured (JSON) with requestId, companyId
   - no secrets or personal data
   - kept for 90 days, then deleted (privacy)
5. Traces:
   - OpenTelemetry - see where a slow request spent its time
6. Analytics:
   - key events only, no personal data, e.g. flag created, flag toggled, user invited, login

## 11. Error Handling

1. The dashboard user
   - Clear, friendly messages - never technical ones
   - Form errors under the field, typed values kept
   - Unexpected errors show an error id for support
2. The developer debugging
   - Full error details in logs + Sentry, never sent to the client
   - Same error id in the logs as the user sees
3. The customer's app using the SDK
   - Never throw - always return a value
   - If the server is down: use the last values, then the fallback in code

## 12. Architecture

## 13. Scalability

scale only what your numbers say will break

1. SDK reads: in-memory cache, stateless servers, add servers behind the LB (autoscale)
2. Rate limit per SDK key (one customer can't slow others)
3. SSE connections: scale by connection count; move SDK to its own service when it grows
4. DB: connection pooling, indexes, partition logs by month; replica only if needed
5. Static files: CDN
6. Later: CDN edge for flag configs, multiple regions

## 14. Tools

1. Auth: Better Auth (email + password, sessions in Postgres)
2. Errors: Sentry (Exceptions with a stack trace, user and page), send slack message
3. Logs: pino → Loki (pino writes JSON logs, Loki stores and searches them)
4. Metrics + alerts: Prometheus + Grafana (Collects numbers, then dashboards and alerts)
5. Traces: OpenTelemetry → Tempo (Where a slow request spent its time)
6. Uptime: Uptime Kuma (Pings /api/health from outside, then alerts), send slack message
7. Analytics: PostHog (PostHog = product analytics; Umami = simple privacy-friendly page analytics)
8. Validation: zod (One schema per form, used on the server)
9. Cache / pub-sub: Redis (cache)
10. Lint: oxlint
11. Format: oxfmt
12. Typecheck: tsgo
13. Unused code: Knip
14. Tests: Vitest, Testing Library, Playwright
15. CI/CD: GitHub Actions
16. Package manager: npm

## 15. Summary

Keep it as simple and cheap as possible,
we don't know what will happen in the future and how we would like to change it
and the more moving part we have the harder it will be to change the system later on.
