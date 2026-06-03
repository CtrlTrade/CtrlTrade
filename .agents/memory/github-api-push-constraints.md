---
name: GitHub API push constraints (CtrlTrade repo)
description: Pushing to CtrlTrade/CtrlTrade via the integration token — which APIs work, scope limits, and how the desktop installer version is derived.
---

# Pushing to CtrlTrade/CtrlTrade via the GitHub integration token

## The rules
- The **git data API works** for batch pushes: create blobs (`POST /git/blobs`), build a tree with `base_tree` (`POST /git/trees`), create a commit (`POST /git/commits`), then move the branch (`PATCH /git/refs/heads/main`). This pushes many files in ONE commit and is far better than per-file Contents API. (An earlier note here claimed trees returned 404 — that was wrong/transient; it works.)
- The integration token has `repo` scope but **NOT `workflow` scope**. Any tree/commit that adds or modifies a file under `.github/workflows/` is rejected. Keep those paths OUT of the pushed tree (re-use the existing blob or just omit the change); the user must edit workflow files in GitHub directly or re-authorize with `workflow` scope.
- Exclude `attached_assets/` from pushes — those are local screenshots/build-output zips (tens of MB), not source.
- Tag a release by creating a ref: `POST /git/refs` with `ref: "refs/tags/vX.Y.Z"`. **The build-desktop workflow triggers ONLY on `v*.*.*` tag push, NOT on branch push** — pushing to main alone does nothing; you must also create/move the tag.

## Desktop installer version
**The Windows installer filename comes from `desktop/ctrltradepos-electron/package.json` `version`, NOT the git tag.** electron-builder never reads the tag. To ship `CtrlTradePos-Setup-X.Y.Z.exe`, bump `version` in that package.json before tagging. (A CI step to auto-sync version from the tag exists locally but can't be pushed without `workflow` scope.)

**Why:** A tag of `v1.0.7` still produced `...Setup.0.0.0.exe` because package.json was stuck at `0.0.0`. Bumping the static field is the reliable lever.
