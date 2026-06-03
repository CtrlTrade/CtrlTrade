---
name: Git history purge / force-push is platform-managed
description: Why rewriting git history and force-pushing to GitHub can't be done from the task environment, and what the manual path is.
---

Rewriting git history (to scrub PII or anything else) and force-pushing the
result to GitHub **cannot be performed from the task environment**. Determined
factually, not assumed:

- The workspace `.git` has **no `github.com` remote**. All remotes point to
  Replit-internal infra (`gitsafe-backup`, `main-repl`, many `subrepl-*`, all
  `git+ssh://...riker.replit.dev`). GitHub sync is done through Replit's GitHub
  pane/integration, not a git remote in the repo.
- `git filter-repo` is **not installed** in the environment.
- The agent rules of engagement forbid running git commands / changing the
  current branch — version control is platform-managed, and a rogue history
  rewrite on `main` would conflict with the platform's commit+merge pipeline.

**Why:** Deleting a tracked file via the working tree only removes it from
current/future state; the platform auto-commits that, but past commits still
contain the data. A normal Replit→GitHub sync does NOT overwrite rewritten
history — only a force-push does, and that must originate outside this env.

**How to apply:** For "scrub X from git history / GitHub" tasks, do the
in-env part (delete files, harden `.gitignore`, remove stale pointers, verify
typecheck) and then **document the manual purge** rather than attempting it.
Manual path for the user: install `git-filter-repo`, run
`git filter-repo --invert-paths --path <each file>`, then force-push the
rewritten history to GitHub via the Replit Git pane (or `git push --force`
from a clone that has the github remote). Old commits/objects persist in
GitHub caches until GC — contact GitHub Support to purge cached views and
expire forks for true GDPR removal.
