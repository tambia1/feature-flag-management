# System Design - Feature Flag Management

Diagrams (wireframes, data model, architecture) are in [systemDesign.excalidraw](systemDesign.excalidraw).

## Prompt

We need a "feature flag management" web app.

- The app is managed by our team (the platform admins), who can add and remove companies, each with a company admin.
- A company admin can create projects, environments, teams and users for their company.
- Each team gets permissions per environment (viewer / editor).
- Users can manage flags (add / modify / archive / delete) in the environments their teams allow.
- Each company's apps read the flag values through an SDK.

## 1. Requirements

### 1.1 Clarifications

| Question | Answer |
| --- | --- |
| Is this a public app or internal? | Public - many companies, each sees only its own data |
| Is our company also one of the companies? | Yes - it also manages the app: adding other companies |
| How is the first platform admin created? | By a seed script |
| Who can sign up? | No public sign-up - users are created by a company admin |
| How do users join a company? | The admin creates the user with a password (the UI helps generate it). The user can keep it or change it; no need to track first login |
| Can a user be in more than one company? | No |
| Can a user be in more than one team? | Yes - gets the highest role from their teams |
| What can a member with no team do? | Nothing - sees a message to ask the admin to add them to a team |
| What are teams for? | Setting permissions per group |
| Does a company have projects? | Yes (multiple apps) |
| Who creates projects? | Company admin |
| Do environments belong to a project or to the company? | Project |
| Who creates environments? | Company admin |
| Can users turn flags on/off in production? | Production is just another environment - permissions are set per environment |
| Where are roles set? | Company role: on the user (admin / member) - manages the company, not flags. Environment role: on the team (viewer / editor) - the only way to access flags, for admins too |
| Can we delete flags? | Yes - archive first, then delete |
| What does an app get for an archived flag? | The flag's default value (the "off" value). If the flag is deleted or the service is down, the app uses the fallback value in its code |
| Flag types? | boolean, string, number, JSON |
| Targeting? | Rules per environment: conditions on user attributes, AND / OR, specific users, % rollout |
| Do we need a change history? | Yes - a log of who changed what and when, with the value before and after, for flags and for users / teams / permissions. Also companies added and removed by the platform, kept so each company sees only its own logs |
| Can a company have more than one admin? | Yes |
| Who can add more platform admins? | Another platform admin |
| Can the last admin be removed? | No - a company must always have at least one admin (same for platform admins) |

### 1.2 Functional requirements (user stories)

"As a [role], I can [action]"

**Platform admin**

1. Add a company with its first admin
2. Remove a company
3. List companies
4. Add other platform admins
5. See the platform log

**Company admin**

1. Modify the company's profile details
2. Create a project
3. Create environments for each project
4. Create / update / delete users
5. Create teams and add users to them
6. Add / remove permissions for each team
7. Edit and delete projects, environments and teams
8. Make a user an admin
9. See and rotate SDK keys
10. See the company log
11. Manage flags only if I'm in the right team

**Member**

1. Create / archive / delete a flag in any environment where my team is editor
2. Turn a flag on/off, set targeting rules, restore an archived flag, search and filter flags, see a flag's history

**Viewer**

1. View flags

**SDK (the company's app)**

1. Get the flag values for a user in my environment
2. Authenticate with the environment key
3. Receive changes right away

**Everyone**

1. Log in, log out, change password, see my teams and permissions

### 1.3 Non-functional requirements

**Scale (assumptions)**

- 1,000 companies now, 10,000 in 5 years
- 50K dashboard users
- SDK: 1,000 reads / sec average, 10,000 at peak
- Flag changes: ~0.1 / sec
- Read : write ≈ 10,000 : 1

**Performance**

- SDK: get flag values in < 50ms
- A flag change reaches apps in < 5 seconds
- Dashboard: first page load < 2 seconds

**Availability**

- SDK: 99.99% - if it's down, customers' apps are affected
- Dashboard: 99.9% - if it's down, only flag editing stops
- If the service is unreachable, the SDK keeps using the last values it got, and then the fallback in code

**Consistency or availability?**

- SDK reads: availability - a value a few seconds old is fine
- Dashboard writes: consistency - last save wins, and no audit log entry may be lost

**Security**

- Tenant isolation - a company can never see another company's data
- RBAC - roles per environment, through teams
- SDK keys per environment, can be rotated
- Passwords hashed; audit log can't be edited

**Storage**

- Small (~12GB of flags, ~7GB of logs per year) - one Postgres database is enough
- Audit log kept for (?) years

**SEO** - No, login is required. Use SSR only where it makes pages faster.

**Accessibility** - Yes: WCAG AA, keyboard navigation, screen readers.

**Device support** - Desktop first; mobile must be able to turn a flag off (emergency kill switch).

**i18n** - English only at first.

### 1.4 Constraints

| | |
| --- | --- |
| Frontend | React + Next.js + CSS Modules |
| Language | TypeScript |
| Database | Postgres + Prisma |
| Hosting | AWS |
| Team | 1 developer |
| Timeline | First version in 1 week |
| Budget | Free tiers only at first |
| Starting point | New repo |

## 2. UI Wireframes

See [systemDesign.excalidraw](systemDesign.excalidraw).

## 3. Data Models

See [systemDesign.excalidraw](systemDesign.excalidraw) and [prisma/schema.prisma](../prisma/schema.prisma).

## 4. API (REST)

### 4.1 Auth

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | everyone | |
| POST | `/api/auth/logout` | logged in | |
| GET | `/api/me` | logged in | current user |
| PATCH | `/api/me/password` | logged in | change password |
| GET | `/api/me/roles` | logged in | my teams + role per env |

### 4.2 Companies

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/companies` | platform admin | |
| POST | `/api/companies` | platform admin | + first admin |
| GET | `/api/companies/:companyId` | platform admin (any) · company admin (own) | |
| PATCH | `/api/companies/:companyId` | platform admin (any) · company admin (own) | |
| DELETE | `/api/companies/:companyId` | platform admin | not the platform company |

### 4.3 Users

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/users?search=` | company admin | |
| POST | `/api/users` | company admin | |
| PATCH | `/api/users/:userId` | company admin | name, email, role, new password |
| DELETE | `/api/users/:userId` | company admin | not the last admin |

### 4.4 Teams

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/teams` | company admin | |
| POST | `/api/teams` | company admin | |
| PATCH | `/api/teams/:teamId` | company admin | rename |
| DELETE | `/api/teams/:teamId` | company admin | |
| GET | `/api/teams/:teamId/members` | company admin | |
| POST | `/api/teams/:teamId/members` | company admin | `{ userId }` |
| DELETE | `/api/teams/:teamId/members/:userId` | company admin | |
| GET | `/api/teams/:teamId/permissions` | company admin | |
| PUT | `/api/teams/:teamId/permissions` | company admin | whole grid |

### 4.5 Projects & environments

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/projects` | logged in | only projects I can access |
| POST | `/api/projects` | company admin | |
| PATCH | `/api/projects/:projectId` | company admin | rename |
| DELETE | `/api/projects/:projectId` | company admin | |
| GET | `/api/projects/:projectId/environments` | logged in | only envs I can access |
| POST | `/api/projects/:projectId/environments` | company admin | |
| PATCH | `/api/environments/:environmentId` | company admin | rename |
| DELETE | `/api/environments/:environmentId` | company admin | |
| POST | `/api/environments/:environmentId/rotate-key` | company admin | |

### 4.6 Flags

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/projects/:projectId/flags?environmentId=&search=&status=&archived=` | viewer | |
| POST | `/api/projects/:projectId/flags` | editor | + variations + starting on/off |
| GET | `/api/flags/:flagId` | viewer | |
| PATCH | `/api/flags/:flagId` | editor | name, description, variations |
| POST | `/api/flags/:flagId/archive` | editor | |
| POST | `/api/flags/:flagId/restore` | editor | |
| DELETE | `/api/flags/:flagId` | editor | only if archived |
| GET | `/api/flags/:flagId/environments/:environmentId` | viewer | on/off, off value, targets, rules |
| PATCH | `/api/flags/:flagId/environments/:environmentId` | editor | + comment |
| GET | `/api/flags/:flagId/history?environmentId=` | viewer | |

### 4.7 Logs

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/logs?userId=&targetType=&from=&to=` | company admin / platform admin | |

### 4.8 SDK (used by the companies' apps, not the dashboard)

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/api/sdk/evaluate` | SDK key | |
| GET | `/api/sdk/stream` | SDK key | real-time: "flags changed, fetch again" |

```http
POST /api/sdk/evaluate
Authorization: <sdkKey>

{ "context": { "key": "user-42", "country": "IL", "plan": "pro" } }
```

Reply:

```json
{ "new-checkout": true, "homepage-banner": "Big sale today!" }
```

### 4.9 Other

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | everyone | load balancers, monitoring |
| GET | `/api/docs` | dev only | Swagger UI |
| GET | `/api/docs/spec` | dev only | OpenAPI spec (`openapi.yaml`) |

### 4.10 Two rules every endpoint follows

- 401 if not logged in
- 403 if the role isn't allowed

## 5. Database

1. **Postgres + Prisma**
   - The data is relational
   - The non-functional requirements ask for consistency
   - Small data: ~120GB in 5 years fits one server easily
2. **Cache** - flags are read-heavy; most reads never reach the database
3. **S3** - not needed; it's for files like images and videos

## 6. Authentication & Authorization

### 6.1 Authentication (who are you)

- All users must be logged in to use the app
- Email + password

### 6.2 Authorization (what can you do)

- **Platform admin:** an ADMIN of the company with `isPlatform = true`
- **Company admin:** `User.role = ADMIN` → manages users, teams, projects, envs, company
- **Flag access:** only through teams: highest role (viewer / editor) per environment, admins included
- **Tenant isolation:** the company is always taken from the session, never from the URL
- Checked on the server for every request: 401 = not logged in, 403 = not allowed
- The UI hides what you can't do, but the server is what enforces it

### 6.3 JWT or session?

Session:

1. Instant logout and revoke (e.g. when a user is deleted)
2. Simple and safe (a cookie holding a random id)
3. Speed isn't a problem: the dashboard has low traffic; the SDK is the high-traffic path

## 7. State management

| Kind | Where |
| --- | --- |
| Server data | Server Components (fetch on the server), re-fetch after changes |
| URL state | project, environment, filters, search, tabs (shareable, survives reload) |
| Session | server (cookie) → layout → small React context for client components |
| Local UI | `useState` in the owning component |
| Forms | `useActionState` + Server Actions |
| Optimistic UI | only the flag on/off toggle (`useOptimistic`, rollback on error) |
| Global store | none (Redux / Zustand not needed) |

## 8. Component Architecture

### 8.1 Routes

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

### 8.2 Layers

| Layer | Role |
| --- | --- |
| Pages (server) | fetch data, check permissions, compose features |
| Feature components | FlagTable, TargetingEditor, PermissionsGrid, UserRow… (per screen) |
| Shared UI components | Button, Input, Field, Select, Table, Dialog, Toggle, Message… |

## 9. CI/CD

### 9.1 On every PR

- lint
- format
- typecheck (tsc)
- prisma validate + migration check
- unit tests
- next build
- integration tests
- preview deploy of the PR
- e2e tests against the preview (Playwright)

### 9.2 Merge to main

- run tests after merge to main (merge queue)
- deploy
- send a message to a Slack channel (fail / success)

## 10. Observability

Goal: know about slowness or bugs before users report them - and never guess why.

1. **Errors:** Sentry on client and server (mask user details - privacy)
2. **Metrics:**
   - SDK evaluate latency p99 < 50ms, availability 99.99%
   - flag change reaches apps < 5s
   - cache hit rate, open SDK stream connections
   - dashboard 5xx errors, first page load < 2s
   - Postgres: connections, slow queries, CPU, disk
3. **Alerts:**
   - urgent (page): SDK errors > 0.1% / p99 > 50ms / propagation > 5s
   - Slack: dashboard errors rising
   - external uptime check on `/api/health` every minute
4. **Logs:**
   - structured (JSON) with requestId, companyId
   - no secrets or personal data
   - kept for 90 days, then deleted (privacy)
5. **Traces:** OpenTelemetry - see where a slow request spent its time
6. **Analytics:** key events only, no personal data, e.g. flag created, flag toggled, user invited, login

## 11. Error Handling

1. **The dashboard user**
   - Clear, friendly messages - never technical ones
   - Form errors under the field, typed values kept
   - Unexpected errors show an error id for support
2. **The developer debugging**
   - Full error details in logs + Sentry, never sent to the client
   - The same error id in the logs as the user sees
3. **The customer's app using the SDK**
   - Never throw - always return a value
   - If the server is down: use the last values, then the fallback in code

## 12. Architecture

See [systemDesign.excalidraw](systemDesign.excalidraw).

## 13. Scalability

Scale only what your numbers say will break.

1. **SDK reads:** in-memory cache, stateless servers, add servers behind the LB (autoscale)
2. **Rate limit per SDK key** (one customer can't slow others)
3. **SSE connections:** scale by connection count; move the SDK to its own service when it grows
4. **DB:** connection pooling, indexes, partition logs by month; replica only if needed
5. **Static files:** CDN
6. **Later:** CDN edge for flag configs, multiple regions

## 14. Tools

| Area | Tool | Why |
| --- | --- | --- |
| Auth | Better Auth | email + password, sessions in Postgres |
| Errors | Sentry | exceptions with stack trace, user and page; Slack message |
| Logs | pino → Loki | pino writes JSON logs, Loki stores and searches them |
| Metrics + alerts | Prometheus + Grafana | collects numbers, then dashboards and alerts |
| Traces | OpenTelemetry → Tempo | where a slow request spent its time |
| Uptime | Uptime Kuma | pings `/api/health` from outside, then alerts; Slack message |
| Analytics | PostHog | product analytics (Umami = simple privacy-friendly page analytics) |
| Validation | zod | one schema per form, used on the server |
| Cache / pub-sub | Redis | cache |
| Lint | oxlint | |
| Format | oxfmt | |
| Typecheck | tsgo | |
| Unused code | Knip | |
| Tests | Vitest, Testing Library, Playwright | |
| CI/CD | GitHub Actions | |
| Package manager | npm | |

## 15. Summary

Keep it as simple and cheap as possible. We don't know what will happen in the future or how we'll want to change it, and the more moving parts we have, the harder it will be to change the system later.
