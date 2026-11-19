---
name: mvc
description: Where code belongs between Model, View and Controller in this project. Use when adding or moving logic, writing a server action or API route, a page that loads data, a hook, or a helper in lib/.
---

# MVC

Keep three layers apart. The View sends user actions to a Controller, the Controller calls the Model, and the Model owns the rules and the data.

## Model: business rules and data

Lives in the domain modules of `lib/` (such as `lib/flags/*`, `lib/permissions.ts`, `lib/roles.ts`, `lib/environments.ts`) and in `prisma/schema.prisma`.

- Holds every rule of the business: what is allowed, how values are computed, what is stored and for how long. Examples: flag evaluation in `lib/flags/evaluate.ts`, context retention in `lib/flags/contexts.ts`.
- Each rule lives in one function, so every caller gets the same answer.
- Takes plain typed values and returns plain data. No React, `FormData`, `Request`, `Response`, `redirect` or UI text.

## Controller: request in, response out

Server actions (`actions.ts`) and API routes (`app/api/**/route.ts`).

1. Read and validate the input (`text(formData, ...)`, zod).
2. Check who is asking (`assertUser`, `assertEnvironmentRole`, `assertProjectEditor`).
3. Call the Model.
4. Return a result, `redirect`, or a `Response`.

Keep it short. A branch that decides something about the business belongs in the Model. Several writes that together make one business operation go into one Model function, not into the action.

## View: what the user sees

`page.tsx`, `layout.tsx`, components and hooks.

- Shows data and sends user actions to a Controller.
- No business rules, permission decisions or database writes.
- A server page may read data to show it, with a simple `select` query or a Model function. Filtering by a business rule or computing a value goes in the Model.
- Hooks hold UI state only: open or closed, timers, countdowns, subscriptions.
- Hiding a button the user can't use is fine, but the Controller still checks. The View's check is only for display.

## Helpers

"Utils" is not a layer. Each helper belongs to one layer: display formatting (`lib/format.ts`) to the View, reading form input (`lib/actions.ts`) to Controllers, domain math (`hashToPercent`) to the Model. Don't mix display formatting and business rules in one helper.

## Quick test

- Would the rule still apply with no UI at all, for example from a CLI or a mobile app? Model.
- Does it turn a request into a Model call and a response? Controller.
- Is it about how something looks or behaves on screen? View.

## Existing code

Some older actions still write with Prisma directly, such as `archiveFlag`. Don't rewrite them unasked. Follow these rules for new code and for code you are already changing.
