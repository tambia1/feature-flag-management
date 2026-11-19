---
name: versioning
description: Bump the app version on every commit to main. Use before committing to the main branch, or when asked about the app version.
---

# Versioning

Every commit to `main` raises the app's minor version by one, in the same commit as the change.

## How

1. Check the branch: `git branch --show-current`. Only bump on `main`. Commits on other branches don't bump; the bump happens when the work lands on `main`.
2. Run `npm version minor --no-git-tag-version`. It updates `package.json` and `package-lock.json`, sets the patch number back to 0, and makes no commit or tag of its own. Example: `0.4.2` becomes `0.5.0`.
3. Stage both files with the rest of the change and commit once.
4. Say the new version in the reply, e.g. "Version is now 0.5.0".

## Rules

- One bump per commit, never more. If a task makes several commits to `main`, each one bumps.
- Only the root `package.json` counts. It is the version shown at the bottom of the sidebar. `docs/ExampleApp` and `sdk` keep their own versions.
- Don't bump when the commit only changes files under `.claude/` or only the version itself.
- Don't edit the version number by hand; always use `npm version` so the lock file stays in step.
