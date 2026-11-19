---
name: versioning
description: Bump the app version once in every pull request, so each merge to main raises it. Use before opening or merging a pull request, or when asked about the app version.
---

# Versioning

Every pull request raises the app's minor version by one. Work reaches `main` only through squash-merged pull requests (see the pull-requests skill), so each merge to `main` is one commit with one bump.

## How

1. On the PR branch, once the change is ready, run `npm version minor --no-git-tag-version`. It updates `package.json` and `package-lock.json`, sets the patch number back to 0, and makes no commit or tag of its own. Example: `0.4.2` becomes `0.5.0`.
2. Commit both files on the branch, with the change or as its own commit, and push.
3. Say the new version in the reply, e.g. "Version is now 0.5.0".

## Rules

- One bump per pull request, never more. More commits on the same branch don't bump again.
- If `main` changed its version while the PR was open, merge `origin/main` into the branch, take `main`'s version in `package.json` and `package-lock.json`, and bump again from there so the PR is exactly one above `main`.
- Only the root `package.json` counts. It is the version shown at the bottom of the sidebar. `docs/ExampleApp` and `sdk` keep their own versions.
- Don't bump when the pull request only changes files under `.claude/` or only the version itself.
- Don't edit the version number by hand; always use `npm version` so the lock file stays in step.
