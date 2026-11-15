---
name: types
description: Conventions for TypeScript types in this project. Use when adding or editing a type, or typing props, function parameters or query results.
---

# Types

Don't re-create types. Keep shared domain types in `app/types` and import them from there. When a new domain type is needed in more than one place, add it there.

If an existing type doesn't fit, fix the shared type or make the data match it, for example by selecting the missing fields in the query. Don't write an inline copy of its fields or a narrowed version of it.
