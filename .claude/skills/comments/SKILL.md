---
name: comments
description: Rule for code comments in this project. Use when writing or editing any code, including fixes, tests and config.
---

# Comments

No comments in code. None at all: no `//`, `/* */`, `/** */` (JSDoc), `{/* */}`, CSS `/* */` or Prisma `//`.

That includes comments that describe what a component, function, type or prop is, such as:

```tsx
/** A bordered panel, e.g. the "Add user" form or the danger zone. */
```

and comments explaining a change, a fix or why a line is there.

Make the code say it instead, with clear names and small functions. Put the reason for a change in the commit message.

The only exception is a directive a tool reads, such as `// @vitest-environment jsdom`.
