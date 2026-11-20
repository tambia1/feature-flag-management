---
name: pull-requests
description: Every task lands on main through a pull request, merged only when all CI checks pass. Use when starting any task that changes files, before committing, pushing, opening a PR or merging.
---

# Pull requests

Every task, whether a feature, a bug fix, a refactor or a config change, goes through a pull request. Nothing is pushed straight to `main`. A PR is merged only when every CI check on it has passed. The merge to `main` starts the Deploy workflow.

## Steps

1. Start from an up-to-date `main` on a new branch, one branch per task:
   ```bash
   git switch main && git pull --ff-only && git switch -c <short-task-name>
   ```
   Name the branch after the task in a few words, e.g. `fix-toggle-in-production`, `add-flag-search`.
2. Do the work and commit on the branch. Every commit stays in `main`'s history after the merge, so give each one a message that says what it changed and why.
3. Before pushing, run `npm run check`. For changes to pages, routes, the database schema or anything e2e covers, run `npm run ci`.
4. Bump the version on the branch as described in the versioning skill.
5. Push the branch and open the PR:
   ```bash
   git push -u origin <branch>
   gh pr create --base main --title "<what changed>" --body "<why, and how it was checked>"
   ```
6. Wait for CI on the PR. Read the result with `gh pr checks <number>`. If a check fails, read its log (`gh run view <run-id> --log-failed`), fix it on the same branch and push again. CI runs again on every push.
7. Ask the user before merging, because the merge starts the Deploy workflow. Once they agree, turn on auto-merge, even while checks are still running:
   ```bash
   gh pr merge <number> --merge --auto --delete-branch
   ```
   A ruleset on `main` requires all nine CI checks, so GitHub merges the PR the moment the last one passes and never before. If a check fails, the PR stays open: fix it and push, and auto-merge stays on.
8. Right after turning on auto-merge, wait for the merge in a background command, so you are woken when it finishes instead of ending the task on the PR branch:
   ```bash
   gh pr checks <number> --watch --fail-fast && until [ "$(gh pr view <number> --json state -q .state)" != OPEN ]; do sleep 10; done; gh pr view <number> --json state,mergeCommit
   ```
   It ends either when the PR is merged or as soon as a check fails. If the state it prints is still `OPEN`, a check failed: fix it, push, and start the wait again.
9. Once the state is `MERGED`, switch back with `git switch main && git pull --ff-only`, delete the local branch with `git branch -d <branch>`, then check that the Deploy run for the merge commit passed:
   ```bash
   gh run list --workflow Deploy --commit <merge-commit> --json status,conclusion,url
   ```

## Rules

- Never push to `main` directly, and never commit on `main`.
- Never merge a PR with a failing, cancelled or still-running check. Never use `--admin`, never change or turn off the `main` ruleset, and never find any other way around a failing check.
- One task per PR. Unrelated changes found along the way go in their own PR.
- Merge with a merge commit (`--merge`), never squash or rebase, so `main` keeps every commit of the PR and the git graph shows where each branch split off and joined back. Delete the branch after merging: the merge commit keeps its history.
- If `main` moved on while the PR was open, update the branch with `git merge origin/main` and let CI run again before merging.
