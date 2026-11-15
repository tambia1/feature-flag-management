---
name: prisma
description: Conventions for Prisma queries in this project. Use when writing or editing a Prisma query.
---

# Prisma

Don't use `omit`. List the fields you want with `select`.

With `omit`, a sensitive field added to the model later is returned by every existing query unless someone remembers to omit it there too. With `select`, a new field is never returned until it is asked for.
